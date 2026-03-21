"""
Management command: migrate_files_to_embeddings

Reads attachedFiles from every non-archived Microapp's app_json, fetches the
pre-extracted text from S3 (text_filename key), chunks it, generates embeddings
via LiteLLM, and stores FileSource + AppFileReference + DocumentChunk rows.

Usage:
    # Dry run (no DB writes, no S3 reads):
    python manage.py migrate_files_to_embeddings --dry-run

    # Migrate everything:
    python manage.py migrate_files_to_embeddings

    # Single app:
    python manage.py migrate_files_to_embeddings --app-id 42

    # Re-process files that previously failed:
    python manage.py migrate_files_to_embeddings --include-failed

Safety guarantees:
    - Skips files that already have a FileSource + chunks (idempotent).
    - Each file is wrapped in its own DB transaction; one failure won't affect others.
    - All errors are logged and counted; the command exits with code 1 if any file failed.
"""
import json
import logging
import os
import sys
import tempfile

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.microapps.models import AppFileReference, DocumentChunk, FileSource, Microapp
from apps.microapps.rag_service import TextChunker, generate_embeddings_batch

log = logging.getLogger(__name__)


def _s3_client():
    return boto3.client(
        "s3",
        config=Config(signature_version="s3v4"),
        region_name=settings.AWS_S3_REGION_NAME,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _fetch_s3_text(s3, key: str) -> str | None:
    """Download a text file from S3 and return its content, or None on failure."""
    try:
        obj = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
        return obj["Body"].read().decode("utf-8")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("NoSuchKey", "404"):
            return None
        raise


def _fetch_s3_binary(s3, key: str) -> bytes | None:
    """Download a binary file from S3, or None if not found."""
    try:
        obj = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
        return obj["Body"].read()
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            return None
        raise


def _text_key_from_original(app_id: int, filename: str) -> str:
    base, ext = os.path.splitext(filename)
    return f"microapps/{app_id}/files/text/{base}__{ext.lstrip('.')}.txt"


def _original_key(app_id: int, filename: str) -> str:
    return f"microapps/{app_id}/files/original/{filename}"


def _normalize_attached_file_entry(file_entry) -> dict | None:
    """
    attachedFiles is usually a list of dicts (original_filename, text_filename, …).
    Legacy rows may store bare filename strings instead.
    """
    if isinstance(file_entry, str):
        name = file_entry.strip()
        if not name:
            return None
        return {
            "original_filename": name,
            "text_filename": None,
            "description": "",
        }
    if isinstance(file_entry, dict):
        return file_entry
    log.warning(
        "Unexpected attachedFiles entry type=%s value=%r",
        type(file_entry).__name__,
        file_entry,
    )
    return None


def _extract_text_from_binary(content: bytes, filename: str) -> str | None:
    """Write bytes to a temp file and run DocumentProcessor on it."""
    from apps.microapps.document_parser import DocumentProcessor

    ext = os.path.splitext(filename)[1] or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        result = DocumentProcessor().extract_text(tmp_path)
        if not result or result.startswith("Error:") or result == "Unsupported file format":
            return None
        return result
    finally:
        os.unlink(tmp_path)


class Command(BaseCommand):
    help = "Migrate existing S3 sidebar files to pgvector embeddings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Log what would happen without writing anything.",
        )
        parser.add_argument(
            "--app-id",
            type=int,
            default=None,
            help="Migrate a single app by ID.",
        )
        parser.add_argument(
            "--include-failed",
            action="store_true",
            help="Re-process files whose FileSource has status=failed.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        app_id = options["app_id"]
        include_failed = options["include_failed"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - no DB writes will occur.\n"))

        qs = Microapp.objects.filter(is_archived=False)
        if app_id:
            qs = qs.filter(id=app_id)

        apps = list(qs)
        self.stdout.write(f"Found {len(apps)} app(s) to process.\n")

        stats = {"migrated": 0, "skipped": 0, "failed": 0, "no_files": 0}
        s3 = _s3_client()

        for app in apps:
            app_json = app.app_json or {}
            if isinstance(app_json, str):
                try:
                    app_json = json.loads(app_json)
                except json.JSONDecodeError:
                    log.warning("app=%d: invalid app_json, skipping", app.id)
                    stats["no_files"] += 1
                    continue

            attached_files = app_json.get("attachedFiles", [])
            if not attached_files:
                stats["no_files"] += 1
                continue

            self.stdout.write(f"\nApp {app.id} — {len(attached_files)} file(s):")

            for raw_entry in attached_files:
                file_entry = _normalize_attached_file_entry(raw_entry)
                if file_entry is None:
                    self.stdout.write(f"  [SKIP] invalid or empty entry: {raw_entry!r}")
                    stats["skipped"] += 1
                    continue

                original_filename = file_entry.get("original_filename") or file_entry.get("name")
                text_filename = file_entry.get("text_filename")
                description = file_entry.get("description", "")

                if not original_filename:
                    self.stdout.write(f"  [SKIP] entry has no original_filename: {file_entry}")
                    stats["skipped"] += 1
                    continue

                result = self._migrate_file(
                    app=app,
                    original_filename=original_filename,
                    text_filename=text_filename,
                    description=description,
                    s3=s3,
                    dry_run=dry_run,
                    include_failed=include_failed,
                )
                stats[result] += 1

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(
            f"Done.  migrated={stats['migrated']}  skipped={stats['skipped']}  "
            f"failed={stats['failed']}  no_files={stats['no_files']}"
        )
        if stats["failed"]:
            sys.exit(1)

    def _migrate_file(
        self,
        app: Microapp,
        original_filename: str,
        text_filename: str | None,
        description: str,
        s3,
        dry_run: bool,
        include_failed: bool,
    ) -> str:
        """
        Migrate one file. Returns 'migrated', 'skipped', or 'failed'.
        Each call is wrapped in its own savepoint so failures are isolated.
        """
        label = f"  app={app.id} file={original_filename}"

        # Check existing state 
        # If another app already has a ready FileSource for this filename, reuse it (clone case)
        shared_ref = AppFileReference.objects.filter(
            file_source__file_name=original_filename,
            file_source__status=FileSource.READY,
        ).exclude(app=app).select_related("file_source").first()

        if shared_ref and not AppFileReference.objects.filter(app=app, file_source=shared_ref.file_source).exists():
            if not dry_run:
                AppFileReference.objects.create(app=app, file_source=shared_ref.file_source)
            self.stdout.write(self.style.SUCCESS(
                f"{label}: reusing existing FileSource from app={shared_ref.app_id} — linked"
            ))
            return "migrated"

        existing_ref = AppFileReference.objects.filter(
            app=app,
            file_source__file_name=original_filename,
        ).select_related("file_source").first()

        if existing_ref:
            fs = existing_ref.file_source
            if fs.status == FileSource.READY:
                self.stdout.write(f"{label}: already ready ({fs.chunk_count} chunks) — skip")
                return "skipped"
            if fs.status == FileSource.FAILED and not include_failed:
                self.stdout.write(f"{label}: previously failed (use --include-failed to retry) — skip")
                return "skipped"
            if fs.status in (FileSource.PENDING, FileSource.PROCESSING):
                self.stdout.write(f"{label}: still processing — skip")
                return "skipped"
            # include_failed=True and status=failed: reset and re-process below

        # Fetch text (always check S3; skip DB writes only in dry-run)
        text_content = None
        source_used = None

        # 1. Try stored text_filename (pre-extracted .txt in S3)
        if text_filename:
            self.stdout.write(f"{label}: trying text key={text_filename}")
            text_content = _fetch_s3_text(s3, text_filename)
            if text_content:
                source_used = "text_filename"
                log.info("%s: fetched %d chars from text_filename", label, len(text_content))

        # 2. Fallback: derive text key from original_filename
        if text_content is None:
            derived_key = _text_key_from_original(app.id, original_filename)
            self.stdout.write(f"{label}: trying derived text key={derived_key}")
            text_content = _fetch_s3_text(s3, derived_key)
            if text_content:
                source_used = "derived_key"
                log.info("%s: fetched %d chars from derived text key", label, len(text_content))

        # 3. Fallback: fetch original file and re-parse
        if text_content is None:
            original_key = _original_key(app.id, original_filename)
            self.stdout.write(f"{label}: trying original file key={original_key}")
            binary = _fetch_s3_binary(s3, original_key)
            if binary:
                text_content = _extract_text_from_binary(binary, original_filename)
                if text_content:
                    source_used = "original_file"
                    log.info("%s: re-extracted %d chars from original file", label, len(text_content))

        # 4. Fallback: cloned app - file lives under a different app's S3 prefix
        if text_content is None:
            other_app_ids = (
                Microapp.objects.exclude(id=app.id)
                .filter(is_archived=False)
                .values_list('id', flat=True)
            )
            for other_id in other_app_ids:
                text_key = _text_key_from_original(other_id, original_filename)
                text_content = _fetch_s3_text(s3, text_key)
                if text_content:
                    source_used = f"clone_source_app={other_id}"
                    log.info("%s: fetched %d chars from cloned source app=%d", label, len(text_content), other_id)
                    break
                binary = _fetch_s3_binary(s3, _original_key(other_id, original_filename))
                if binary:
                    text_content = _extract_text_from_binary(binary, original_filename)
                    if text_content:
                        source_used = f"clone_original_app={other_id}"
                        log.info("%s: re-extracted from cloned source app=%d", label, other_id)
                        break
            if text_content:
                self.stdout.write(f"{label}: found via clone fallback ({source_used})")

        if dry_run:
            if text_content:
                self.stdout.write(self.style.SUCCESS(
                    f"{label}: [DRY RUN] found {len(text_content)} chars via {source_used} — would embed and store"
                ))
                return "migrated"
            else:
                self.stdout.write(self.style.ERROR(
                    f"{label}: [DRY RUN] no text found in S3 — would FAIL"
                ))
                return "failed"

        if not text_content:
            self.stdout.write(
                self.style.ERROR(f"{label}: could not retrieve any text — skipping")
            )
            log.error("%s: no text found in S3 (text_filename=%s)", label, text_filename)
            return "failed"

        # Chunk + embed + store (atomic per file)
        try:
            with transaction.atomic():
                # Reset or create FileSource
                if existing_ref and existing_ref.file_source.status == FileSource.FAILED:
                    file_source = existing_ref.file_source
                    DocumentChunk.objects.filter(file_source=file_source).delete()
                    file_source.status = FileSource.PROCESSING
                    file_source.error = None
                    file_source.chunk_count = None
                    file_source.word_count = None
                    file_source.save()
                else:
                    file_source = FileSource.objects.create(
                        file_name=original_filename,
                        status=FileSource.PROCESSING,
                        file_owner=app,
                    )
                    AppFileReference.objects.create(app=app, file_source=file_source)

                chunks = TextChunker().chunk_text(text_content)
                if not chunks:
                    raise ValueError("Text produced no chunks after splitting")

                word_count = len(text_content.split())

                log.info("%s: generating embeddings for %d chunks", label, len(chunks))
                embeddings = generate_embeddings_batch(chunks)

                DocumentChunk.objects.bulk_create(
                    [
                        DocumentChunk(
                            file_source=file_source,
                            content=chunk_text,
                            embedding=emb,
                        )
                        for chunk_text, emb in zip(chunks, embeddings)
                    ],
                    batch_size=100,
                )

                file_source.status = FileSource.READY
                file_source.chunk_count = len(chunks)
                file_source.word_count = word_count
                file_source.error = None
                file_source.save(update_fields=["status", "chunk_count", "word_count", "error", "updated_at"])

            self.stdout.write(
                self.style.SUCCESS(
                    f"{label}: migrated — {len(chunks)} chunks, {word_count} words"
                )
            )
            return "migrated"

        except Exception as exc:
            log.error("%s: migration failed: %s", label, exc, exc_info=True)
            self.stdout.write(self.style.ERROR(f"{label}: FAILED — {exc}"))
            return "failed"
