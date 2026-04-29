"""
Publish immutable RubricVersion snapshots from the app builder's app_json.
"""
from __future__ import annotations

import json
from typing import Any

from django.db import transaction
from django.db.models import Max

from apps.microapps.models import Microapp, RubricVersion
from apps.microapps.rubric_version_utils import build_definition_for_snapshot


def app_json_to_dict(app_json: Any) -> dict:
    if isinstance(app_json, str):
        if not (app_json or "").strip():
            return {}
        try:
            parsed = json.loads(app_json)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return app_json if isinstance(app_json, dict) else {}


def _definitions_equivalent(a: dict, b: dict) -> bool:
    return json.dumps(a or {}, sort_keys=True, ensure_ascii=False) == json.dumps(
        b or {}, sort_keys=True, ensure_ascii=False
    )


def _no_gates_rubric_result(app: Microapp) -> dict[str, Any]:
    """
    Live app_json has no scoring gates: there is nothing to publish as "active".
    Clear active_rubric_version if it was set (e.g. author removed all gates).
    """
    had_active = app.active_rubric_version_id is not None
    if had_active:
        Microapp.objects.filter(pk=app.pk).update(active_rubric_version_id=None)
    return {
        "created": False,
        "rubric_version_id": None,
        "version_number": None,
        "label": None,
        "gates_count": 0,
        "message": (
            "No scoring gates in app; cleared active rubric version."
            if had_active
            else "No scoring gates in app; no rubric version to assign."
        ),
    }


def _apply_rubric_publish_if_needed(
    app: Microapp,
    *,
    label: str | None = None,
) -> dict[str, Any]:
    """
    Compare live app_json scoring layout to active_rubric_version; create a new
    RubricVersion and set active when they differ.

    Caller must hold a row lock on ``app`` (e.g. select_for_update) if concurrent
    scored runs are possible.
    """
    stored = app_json_to_dict(app.app_json)
    new_def = build_definition_for_snapshot(stored)
    active = app.active_rubric_version
    gates = new_def.get("gates") or []
    if not gates:
        return _no_gates_rubric_result(app)

    if active and _definitions_equivalent(active.definition_json, new_def):
        return {
            "created": False,
            "rubric_version_id": active.id,
            "version_number": active.version_number,
            "label": active.label,
            "gates_count": len(new_def.get("gates") or []),
            "message": "Scoring layout matches the published version. No new version was created.",
        }

    max_v = RubricVersion.objects.filter(ma_id=app.id).aggregate(m=Max("version_number"))[
        "m"
    ]
    next_v = (max_v or 0) + 1
    rv_label = (label or "").strip() or f"Version {next_v}"
    rv = RubricVersion.objects.create(
        ma_id=app,
        version_number=next_v,
        label=rv_label,
        definition_json=new_def,
    )
    Microapp.objects.filter(pk=app.pk).update(active_rubric_version_id=rv.id)

    return {
        "created": True,
        "rubric_version_id": rv.id,
        "version_number": next_v,
        "label": rv_label,
        "gates_count": len(new_def.get("gates") or []),
        "message": "Published a new rubric version. New runs will use it for score analytics.",
    }


def reconcile_active_rubric_pointer_after_app_json_save(microapp_id: int) -> None:
    """
    After the editor persists app_json: if there are no scoring gates, clear
    active_rubric_version. Does not create versions (that stays on scored runs).
    """
    try:
        with transaction.atomic():
            app = (
                Microapp.objects.select_for_update(of=("self",))
                .select_related("active_rubric_version")
                .get(pk=microapp_id)
            )
            stored = app_json_to_dict(app.app_json)
            new_def = build_definition_for_snapshot(stored)
            if new_def.get("gates"):
                return
            _no_gates_rubric_result(app)
    except Microapp.DoesNotExist:
        return


def live_rubric_matches_snapshot(app: Microapp, version: RubricVersion) -> bool:
    """
    True when scoring gates derived from the app builder (app_json) match this
    RubricVersion's stored definition (same comparison as publish / analytics).
    """
    stored = app_json_to_dict(app.app_json)
    live_def = build_definition_for_snapshot(stored)
    return _definitions_equivalent(live_def, version.definition_json or {})


def ensure_rubric_version_for_scored_run(microapp_id: int) -> int | None:
    """
    For a real (non-preview) scored run: ensure active_rubric_version matches
    current app_json, creating a new RubricVersion when the layout changed.
    Returns the RubricVersion pk to store on Run.rubric_version, or None if the
    app does not exist or has no scoring gates and no active version.
    """
    try:
        with transaction.atomic():
            # Lock only microapps row: of=("self",) avoids PG FOR UPDATE + nullable outer join error.
            app = (
                Microapp.objects.select_for_update(of=("self",))
                .select_related("active_rubric_version")
                .get(pk=microapp_id)
            )
            result = _apply_rubric_publish_if_needed(app, label=None)
            rid = result.get("rubric_version_id")
            return int(rid) if rid is not None else None
    except Microapp.DoesNotExist:
        return None
