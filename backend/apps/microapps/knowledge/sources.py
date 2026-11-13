"""
Knowledge sources attached to an app: lookup, creation, copy-on-write and removal.

A FileSource can be shared by several apps (a clone references its original's
sources). Anything that changes a source's content must go through
writable_source() first so other apps are not affected.
"""
import logging as log
from datetime import timedelta
from typing import Dict, List, Optional, Tuple

from django.db import transaction
from django.utils import timezone

from apps.microapps.models import AppFileReference, DocumentChunk, FileSource

# A source still "processing" after this long was interrupted (e.g. by a restart).
STALE_AFTER = timedelta(minutes=15)
STALE_MESSAGE = "Processing was interrupted. Please try again."


def app_sources(app):
    return FileSource.objects.filter(app_references__app=app).order_by("created_at", "id")


def get_app_source(app, source_id) -> Optional[FileSource]:
    return FileSource.objects.filter(app_references__app=app, id=source_id).first()


def is_stale(source: FileSource) -> bool:
    return (
        source.status in (FileSource.PENDING, FileSource.PROCESSING)
        and source.updated_at < timezone.now() - STALE_AFTER
    )


def serialize_source(source: FileSource) -> dict:
    metadata = source.metadata or {}
    status, error = source.status, source.error
    if is_stale(source):
        status, error = FileSource.FAILED, STALE_MESSAGE

    data = {
        "id": source.id,
        "type": source.source_type,
        "name": source.file_name,
        "url": source.url,
        "status": status,
        "error": error,
        "warning": metadata.get("warning"),
        "chunk_count": source.chunk_count,
        "word_count": source.word_count,
        "last_fetched_at": source.last_fetched_at,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }
    if source.source_type == FileSource.WEBSITE:
        data["page_count"] = len(metadata.get("pages", []))
        data["failed_pages"] = metadata.get("failed_pages", [])
        data["progress"] = metadata.get("progress") if status == FileSource.PROCESSING else None
    return data


def create_source(app, *, source_type: str, name: str, url: Optional[str] = None,
                  raw_text: Optional[str] = None) -> FileSource:
    with transaction.atomic():
        source = FileSource.objects.create(
            file_name=name[:255],
            source_type=source_type,
            url=url,
            raw_text=raw_text,
            status=FileSource.PENDING,
            file_owner=app,
        )
        AppFileReference.objects.create(app=app, file_source=source)
    return source


def writable_source(app, source: FileSource) -> FileSource:
    """
    Return a source this app may modify. If other apps also reference the given
    source, the app gets its own copy (chunks included) and its reference is
    moved to the copy; the other apps keep the original untouched.
    """
    shared = AppFileReference.objects.filter(file_source=source).exclude(app=app).exists()
    if not shared:
        return source

    with transaction.atomic():
        copy = FileSource.objects.create(
            file_name=source.file_name,
            source_type=source.source_type,
            url=source.url,
            raw_text=source.raw_text,
            metadata=source.metadata,
            last_fetched_at=source.last_fetched_at,
            status=source.status,
            error=source.error,
            chunk_count=source.chunk_count,
            word_count=source.word_count,
            file_owner=app,
        )
        DocumentChunk.objects.bulk_create([
            DocumentChunk(
                file_source=copy,
                content=chunk.content,
                embedding=chunk.embedding,
                chunk_index=chunk.chunk_index,
                metadata=chunk.metadata,
            )
            for chunk in DocumentChunk.objects.filter(file_source=source)
        ], batch_size=100)
        AppFileReference.objects.filter(app=app, file_source=source).update(file_source=copy)
    log.info(f"RAG: app={app.id} got its own copy of shared source={source.id} as source={copy.id}")
    return copy


def mark_pending(source: FileSource) -> None:
    metadata = dict(source.metadata or {})
    metadata.pop("warning", None)
    metadata.pop("progress", None)
    source.metadata = metadata
    source.status = FileSource.PENDING
    source.error = None
    source.save()


def remove_source_from_app(app, source: FileSource) -> int:
    """Detach a source from an app. Deletes it (and its chunks) when no app uses it any more."""
    AppFileReference.objects.filter(app=app, file_source=source).delete()
    if AppFileReference.objects.filter(file_source=source).exists():
        return 0
    deleted_chunks = source.chunk_count or 0
    source.delete()
    return deleted_chunks


def resolve_attached_sources(app, attached_files: List[dict]) -> List[Tuple[dict, FileSource]]:
    """
    Match the entries of app_json["attachedFiles"] to this app's sources.

    Entries carry a source_id when they were added through the knowledge base
    API. Older entries, and entries whose id no longer belongs to the app, are
    matched by name.
    """
    sources = list(app_sources(app))
    by_id: Dict[int, FileSource] = {source.id: source for source in sources}
    by_name: Dict[str, FileSource] = {}
    for source in sources:
        by_name.setdefault(source.file_name, source)

    resolved = []
    used = set()
    for entry in attached_files or []:
        if not isinstance(entry, dict):
            continue
        source = None
        try:
            source = by_id.get(int(entry.get("source_id")))
        except (TypeError, ValueError):
            pass
        if source is None:
            source = by_name.get(entry.get("original_filename") or "")
        if source is not None and source.id not in used:
            used.add(source.id)
            resolved.append((entry, source))
    return resolved
