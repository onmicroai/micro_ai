"""
Ingestion: load a source's text, chunk it, embed it and store the chunks.

New chunks replace the old ones in a single transaction, so a source keeps
serving its previous content while it is being refreshed, and a failed refresh
loses nothing.
"""
import logging as log
from concurrent.futures import ThreadPoolExecutor

from django.db import connection, transaction
from django.utils import timezone

from apps.microapps.models import DocumentChunk, FileSource
from apps.microapps.rag_service import TextChunker, generate_embeddings_batch

from .loaders import Loader, LoadError

# Bounds how many sources are processed at once per server process.
_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="kb-ingest")

MAX_ERROR_LENGTH = 500


def start_ingestion(source_id: int, loader: Loader) -> None:
    """Process a source in the background."""
    _executor.submit(_run_in_thread, source_id, loader)


def _run_in_thread(source_id: int, loader: Loader) -> None:
    try:
        ingest_source(source_id, loader)
    finally:
        connection.close()


def ingest_source(source_id: int, loader: Loader) -> None:
    """Load, chunk, embed and store one source. Records failure on the source instead of raising."""
    try:
        updated = FileSource.objects.filter(id=source_id).update(
            status=FileSource.PROCESSING, updated_at=timezone.now()
        )
        if not updated:
            log.info(f"RAG: source={source_id} was deleted before processing started, skipping")
            return

        result = loader.load(progress=lambda done, total: _record_progress(source_id, done, total))

        pieces = []  # (chunk text, document metadata)
        pages = []
        word_count = 0
        chunker = TextChunker()
        for document in result.documents:
            # PostgreSQL rejects NUL bytes in text columns.
            text = (document.text or "").replace("\x00", "")
            chunks = chunker.chunk_text(text)
            if not chunks:
                continue
            word_count += len(text.split())
            pieces.extend((chunk, document.metadata) for chunk in chunks)
            if document.metadata.get("url"):
                pages.append({
                    "url": document.metadata["url"],
                    "title": document.metadata.get("title", ""),
                    "chunk_count": len(chunks),
                })
        if not pieces:
            raise LoadError("No text could be extracted from this source.")

        embeddings = generate_embeddings_batch([chunk for chunk, _ in pieces])

        with transaction.atomic():
            source = FileSource.objects.select_for_update().filter(id=source_id).first()
            if source is None:
                log.info(f"RAG: source={source_id} was deleted during processing, discarding embeddings")
                return

            DocumentChunk.objects.filter(file_source=source).delete()
            DocumentChunk.objects.bulk_create([
                DocumentChunk(
                    file_source=source,
                    content=chunk,
                    embedding=embedding,
                    chunk_index=index,
                    metadata=metadata,
                )
                for index, ((chunk, metadata), embedding) in enumerate(zip(pieces, embeddings))
            ], batch_size=100)

            metadata = {}
            if result.warning:
                metadata["warning"] = result.warning
            if source.source_type == FileSource.WEBSITE:
                metadata["pages"] = pages
                metadata["failed_pages"] = result.failed_pages
            if source.source_type in FileSource.WEB_TYPES:
                source.last_fetched_at = timezone.now()
                if result.name:
                    source.file_name = result.name[:255]

            source.metadata = metadata
            source.status = FileSource.READY
            source.error = None
            source.chunk_count = len(pieces)
            source.word_count = word_count
            source.save()

        log.info(f"RAG: {len(pieces)} chunks stored for source={source_id}")

    except Exception as exc:
        if isinstance(exc, LoadError):
            message = str(exc)
        else:
            log.exception(f"Knowledge ingestion failed for source={source_id}")
            message = "Something went wrong while processing this source. Please try again."
        _record_failure(source_id, message[:MAX_ERROR_LENGTH])
    finally:
        loader.cleanup()


def _record_progress(source_id: int, done: int, total: int) -> None:
    source = FileSource.objects.filter(id=source_id).only("metadata").first()
    if source is None:
        return
    metadata = dict(source.metadata or {})
    metadata["progress"] = {"pages_done": done, "pages_total": total}
    # updated_at is set by hand because update() skips auto_now; it keeps a
    # long crawl from looking stalled.
    FileSource.objects.filter(id=source_id).update(metadata=metadata, updated_at=timezone.now())


def _record_failure(source_id: int, message: str) -> None:
    try:
        source = FileSource.objects.filter(id=source_id).first()
        if source is None:
            return
        metadata = dict(source.metadata or {})
        metadata.pop("progress", None)
        if DocumentChunk.objects.filter(file_source=source).exists():
            # A refresh failed: the previous content is still in place and usable.
            metadata["warning"] = f"The last update failed, so the previous content is still in use. {message}"
            source.status = FileSource.READY
            source.error = None
        else:
            source.status = FileSource.FAILED
            source.error = message
        source.metadata = metadata
        source.save()
    except Exception:
        log.exception(f"Could not record ingestion failure for source={source_id}")
