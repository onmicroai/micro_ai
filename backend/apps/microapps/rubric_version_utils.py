"""
Build immutable rubric version snapshots from microapp `app_json` for score analysis.
"""
from __future__ import annotations

import json
from typing import Any


def _normalize_rubric_to_str(rubric: Any) -> str:
    if rubric is None:
        return ""
    if isinstance(rubric, str):
        return rubric.strip()
    try:
        return json.dumps(rubric, sort_keys=True, ensure_ascii=False)
    except (TypeError, ValueError):
        return ""


def get_elements_container(app_stored: dict) -> dict:
    """Handle both legacy shapes and v2 { elements, phases } in app_json."""
    if not isinstance(app_stored, dict):
        return {}
    if "elements" in app_stored and isinstance(app_stored.get("elements"), list):
        return app_stored
    inner = app_stored.get("app_json")
    if isinstance(inner, str) and inner.strip():
        try:
            inner = json.loads(inner)
        except json.JSONDecodeError:
            return {}
    if isinstance(inner, dict) and "elements" in inner:
        return inner
    return app_stored if "elements" in app_stored else {}


def extract_gates_from_app_json(app_stored: dict) -> list[dict[str, Any]]:
    """
    List scoring "gates" (scoring elements) with categories and max points
    for analytics row layout.
    """
    root = get_elements_container(app_stored)
    elements = root.get("elements")
    if not isinstance(elements, list):
        return []

    gates: list[dict[str, Any]] = []
    for el in elements:
        if not isinstance(el, dict) or el.get("type") != "scoring":
            continue
        raw_rubric = el.get("rubric")
        if isinstance(raw_rubric, str):
            try:
                table = json.loads(raw_rubric)
            except json.JSONDecodeError:
                table = []
        elif isinstance(raw_rubric, list):
            table = raw_rubric
        else:
            table = []

        categories: list[dict[str, Any]] = []
        if isinstance(table, list):
            for row in table:
                if not isinstance(row, dict):
                    continue
                crit = (row.get("criteria") or row.get("name") or "").strip() or "Criterion"
                max_pts = 0.0
                for line in row.get("lines") or []:
                    if not isinstance(line, dict):
                        continue
                    s = line.get("score")
                    try:
                        sv = float(s) if s is not None else 0.0
                    except (TypeError, ValueError):
                        sv = 0.0
                    if sv > max_pts:
                        max_pts = sv
                categories.append({"name": crit, "max": max_pts})

        gates.append(
            {
                "element_id": el.get("id"),
                "name": el.get("name") or "scoring",
                "rubric_text": _normalize_rubric_to_str(el.get("rubric")),
                "categories": categories,
            }
        )
    return gates


def build_definition_for_snapshot(app_stored: dict) -> dict[str, Any]:
    gates = extract_gates_from_app_json(app_stored)
    return {"gates": gates}


def find_gate_for_run_rubric(
    definition: dict, run_rubric_text: str
) -> dict | None:
    """
    Map a run's stored `Run.rubric` to one gate in the version definition.

    Returns the matching gate dict, or None when the run's rubric text does not
    match any gate (normalized comparison). Callers should omit such runs from
    gate-level aggregates rather than guessing a gate.
    """
    if not run_rubric_text or not run_rubric_text.strip():
        return None
    norm_run = _normalize_rubric_to_str(run_rubric_text)
    if not norm_run and run_rubric_text:
        norm_run = run_rubric_text.strip()
    for gate in definition.get("gates") or []:
        gtxt = (gate or {}).get("rubric_text") or ""
        if not gtxt:
            continue
        n = _normalize_rubric_to_str(gtxt)
        if n == norm_run or gtxt.strip() == run_rubric_text.strip():
            return gate
    return None
