import logging
from django.core.management.base import BaseCommand
from django.db.models import Max, Min, Count

from apps.microapps.models import Run, AppThemeSnapshot, Microapp
from apps.microapps.theme_service import (
    build_conversation_digest,
    generate_themes,
    generate_themes_incremental,
    THEMES_MODEL,
)

log = logging.getLogger(__name__)

MAX_RUNS_PER_APP = 100
MIN_RUNS_REQUIRED = 3
MIN_NEW_RUNS_REQUIRED = 1


class Command(BaseCommand):
    help = "Generate AI theme snapshots for apps with new conversations."

    def handle(self, *args, **options):
        app_stats = (
            Run.objects.values("ma_id")
            .annotate(
                latest_run=Max("timestamp"),
                earliest_run=Min("timestamp"),
                run_count=Count("id"),
            )
            .order_by("ma_id")
        )

        processed = 0
        for row in app_stats:
            app_id = row["ma_id"]
            latest_run = row["latest_run"]
            if not app_id or latest_run is None:
                continue

            latest_snapshot = (
                AppThemeSnapshot.objects.filter(ma_id=app_id, status="success")
                .order_by("-source_window_end", "-generated_at")
                .first()
            )
            latest_snapshot_end = latest_snapshot.source_window_end if latest_snapshot else None
            if latest_snapshot_end and latest_run <= latest_snapshot_end:
                continue

            if latest_snapshot_end:
                runs_qs = (
                    Run.objects.filter(ma_id=app_id, timestamp__gt=latest_snapshot_end)
                    .order_by("timestamp")[:MAX_RUNS_PER_APP]
                )
            else:
                runs_qs = Run.objects.filter(ma_id=app_id).order_by("-timestamp")[:MAX_RUNS_PER_APP]
            runs = list(runs_qs)
            if latest_snapshot_end:
                if len(runs) < MIN_NEW_RUNS_REQUIRED:
                    continue
            else:
                if len(runs) < MIN_RUNS_REQUIRED:
                    continue
                runs = list(reversed(runs))

            source_window_start = runs[0].timestamp
            source_window_end = runs[-1].timestamp
            conversation_count = len({r.session_id for r in runs if r.session_id})
            digest = build_conversation_digest(runs)
            if not digest.strip():
                continue

            app = Microapp.objects.filter(id=app_id).first()
            if app is None:
                continue

            try:
                if latest_snapshot and latest_snapshot.themes_json:
                    themes = generate_themes_incremental(
                        existing_themes=latest_snapshot.themes_json,
                        new_conversation_digest=digest,
                    )
                else:
                    themes = generate_themes(digest)
                AppThemeSnapshot.objects.create(
                    ma_id=app,
                    source_window_start=source_window_start,
                    source_window_end=source_window_end,
                    conversation_count_used=conversation_count,
                    themes_json=themes,
                    model_used=THEMES_MODEL,
                    status="success",
                )
                processed += 1
                self.stdout.write(self.style.SUCCESS(f"Generated themes for app {app_id}"))
            except Exception as exc:
                AppThemeSnapshot.objects.create(
                    ma_id=app,
                    source_window_start=source_window_start,
                    source_window_end=source_window_end,
                    conversation_count_used=conversation_count,
                    themes_json=[],
                    model_used=THEMES_MODEL,
                    status="failed",
                    error_message=str(exc),
                )
                self.stdout.write(self.style.WARNING(f"Failed themes for app {app_id}: {exc}"))

        self.stdout.write(self.style.SUCCESS(f"Theme generation complete. Processed apps: {processed}"))
