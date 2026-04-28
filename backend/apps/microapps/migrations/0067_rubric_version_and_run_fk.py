# Generated manually for rubric versioning + score analysis baseline.

import json

from django.db import migrations, models
import django.db.models.deletion


def _definition_from_app_stored(stored) -> dict:
    """Inline minimal extraction to avoid import cycles during migration; mirrors rubric_version_utils."""
    if not isinstance(stored, dict):
        return {"gates": []}
    if "elements" in stored and isinstance(stored.get("elements"), list):
        root = stored
    else:
        inner = stored.get("app_json")
        if isinstance(inner, str) and inner.strip():
            try:
                inner = json.loads(inner)
            except json.JSONDecodeError:
                inner = {}
        root = inner if isinstance(inner, dict) and "elements" in inner else stored
    elements = root.get("elements")
    if not isinstance(elements, list):
        return {"gates": []}
    gates = []
    for el in elements:
        if not isinstance(el, dict) or el.get("type") != "scoring":
            continue
        raw = el.get("rubric")
        if isinstance(raw, str):
            try:
                table = json.loads(raw)
            except json.JSONDecodeError:
                table = []
        elif isinstance(raw, list):
            table = raw
        else:
            table = []
        categories = []
        if isinstance(table, list):
            for row in table:
                if not isinstance(row, dict):
                    continue
                crit = (row.get("criteria") or row.get("name") or "").strip() or "Criterion"
                max_pts = 0.0
                for line in row.get("lines") or []:
                    if not isinstance(line, dict):
                        continue
                    try:
                        sv = float(line.get("score") or 0)
                    except (TypeError, ValueError):
                        sv = 0.0
                    if sv > max_pts:
                        max_pts = sv
                categories.append({"name": crit, "max": max_pts})
        rubric_str = (
            raw.strip()
            if isinstance(raw, str)
            else json.dumps(raw, sort_keys=True, ensure_ascii=False)
        )
        gates.append(
            {
                "element_id": el.get("id"),
                "name": el.get("name") or "scoring",
                "rubric_text": rubric_str,
                "categories": categories,
            }
        )
    return {"gates": gates}


def backfill_baseline(apps, schema_editor):
    """Create baseline RubricVersion v1 only for apps that have ≥1 scoring gate in app_json."""
    Microapp = apps.get_model("microapps", "Microapp")
    RubricVersion = apps.get_model("microapps", "RubricVersion")
    Run = apps.get_model("microapps", "Run")
    for app in Microapp.objects.all():
        raw = app.app_json
        if isinstance(raw, str) and raw.strip():
            try:
                raw = json.loads(raw)
            except json.JSONDecodeError:
                raw = {}
        if not isinstance(raw, dict):
            raw = {}
        definition = _definition_from_app_stored(raw)
        gates = definition.get("gates") or []
        if not gates:
            continue
        rv = RubricVersion.objects.create(
            ma_id=app,
            version_number=1,
            label="Version 1 (baseline)",
            definition_json=definition,
        )
        app.active_rubric_version_id = rv.id
        app.save(update_fields=["active_rubric_version_id"])
        Run.objects.filter(ma_id=app.id, rubric_version_id__isnull=True).update(
            rubric_version_id=rv.id
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("microapps", "0066_run_is_preview"),
    ]

    operations = [
        migrations.CreateModel(
            name="RubricVersion",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "version_number",
                    models.PositiveIntegerField(),
                ),
                (
                    "label",
                    models.CharField(blank=True, default="", max_length=200),
                ),
                (
                    "definition_json",
                    models.JSONField(default=dict),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "ma_id",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="rubric_versions",
                        to="microapps.microapp",
                    ),
                ),
            ],
            options={"unique_together": (("ma_id", "version_number"),)},
        ),
        migrations.AddField(
            model_name="microapp",
            name="active_rubric_version",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="apps_as_active",
                to="microapps.rubricversion",
            ),
        ),
        migrations.AddField(
            model_name="run",
            name="rubric_version",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="runs",
                to="microapps.rubricversion",
            ),
        ),
        migrations.AddIndex(
            model_name="run",
            index=models.Index(
                fields=["ma_id", "rubric_version", "is_preview", "scored_run"],
                name="run_ma_rv_preview_scored_idx",
            ),
        ),
        migrations.RunPython(backfill_baseline, noop_reverse),
    ]
