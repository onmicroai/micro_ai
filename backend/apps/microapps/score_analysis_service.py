"""
Aggregate scored runs for Score Analysis (gates / categories) by rubric version.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import statistics
from typing import Any

from django.conf import settings
from django.db.models import Count, Max, Q

from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.llm_interface import UnifiedLLMInterface
from apps.microapps.models import Run, RubricVersion, ScoreAnalysisSnapshot
from apps.microapps.rubric_version_utils import find_gate_for_run_rubric
from apps.microapps.score_utils import coerce_run_score_to_dict, parse_run_score_total

log = logging.getLogger(__name__)


def _to_float(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip())
        except ValueError:
            return None
    return None


def _per_criterion_score_keys(score_map: dict[str, Any]) -> list[Any]:
    """
    Keys in `run_score` that hold per-criterion points, in stable map order, excluding
    the aggregate 'total' key (case-insensitive). Used to align with rubric row order
    when the grader renames keys vs the rubric snapshot.
    """
    out: list[Any] = []
    for k in score_map:
        if k is None:
            continue
        s = str(k).strip()
        if not s or s.lower() == "total":
            continue
        out.append(k)
    return out


def _score_value_for_criterion(
    score_map: dict[str, Any],
    cname: str,
    category_index: int,
    num_categories: int,
) -> float | None:
    """
    Map a rubric category to a value in `Run.run_score`. The scorer may use keys that
    don't exactly match the label in the version snapshot (e.g. rephrased text); we
    try exact name, then case-insensitive, then same-index pairing when the number of
    non-total keys matches the number of rubric rows (matches frontend behavior).
    """
    if cname in score_map:
        v = _to_float(score_map.get(cname))
        if v is not None:
            return v
    cnorm = (cname or "").strip().lower()
    for k in list(score_map.keys()):
        if str(k).strip().lower() in ("", "total"):
            continue
        if str(k).strip().lower() == cnorm:
            return _to_float(score_map.get(k))
    per = _per_criterion_score_keys(score_map)
    if (
        num_categories
        and len(per) == num_categories
        and 0 <= category_index < len(per)
    ):
        return _to_float(score_map.get(per[category_index]))
    return None


def _difficulty(pct: float) -> str:
    if pct >= 75:
        return "Easy"
    if pct >= 50:
        return "Moderate"
    return "Difficult"


def _heuristic_insight(
    name: str,
    max_pt: float,
    scores: list[float],
    perfect_pct: float,
    avg: float,
) -> str:
    """Fallback when LLM is off, unavailable, or cannot parse a category row."""
    if not scores:
        return f"No score data for “{name}” yet."
    if perfect_pct >= 80:
        return f"Most students are meeting the full {max_pt:g} point(s) for “{name}”."
    if perfect_pct < 30:
        if avg < max_pt * 0.3:
            return f"“{name}” is a common drop — average {avg:.2g} of {max_pt:g}. Check typical misconceptions for this criteria."
        return f"Few perfect scores on “{name}” ({perfect_pct:.0f}% at max). Review answer patterns against the rubric text."
    return f"Mixed performance on “{name}” (avg {avg:.2g}/{max_pt:g}, {perfect_pct:.0f}% perfect). Tighten instruction or add examples for this criteria."


def _rubric_excerpt(rubric_text: str, limit: int = 3500) -> str:
    t = (rubric_text or "").strip()
    if len(t) <= limit:
        return t
    return t[: limit - 1] + "…"


def _json_dict_from_text(text: str) -> dict[str, Any] | None:
    """
    Best-effort parse of a single JSON object from a model message (fences, prose, etc.).
    """
    t = (text or "").strip()
    if not t:
        return None
    m = re.search(
        r"```(?:json)?\s*(\{[\s\S]*?})\s*```", t, re.IGNORECASE | re.DOTALL
    )
    if m:
        t = m.group(1).strip()
    if not t.lstrip().startswith("{"):
        i = t.find("{")
        if i >= 0:
            t = t[i:].strip()
    i = t.find("{")
    if i < 0:
        return None
    try:
        dec = json.JSONDecoder()
        obj, _ = dec.raw_decode(t[i:])
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        return None


def _match_insight_by_name(name: str, raw: dict[str, str]) -> str | None:
    if not raw:
        return None
    if name in raw and raw[name].strip():
        return raw[name].strip()
    nlow = name.strip().lower()
    for k, v in raw.items():
        if k and k.strip().lower() == nlow and (v or "").strip():
            return v.strip()
    return None


def _parse_llm_insights_payload(obj: dict[str, Any]) -> dict[str, str]:
    """
    Accept {"insights": [{"category": "...", "insight": "..."}]} or
    {"items": same} or a flat {category: insight} if values are str.
    """
    out: dict[str, str] = {}
    if "insights" in obj and isinstance(obj["insights"], list):
        for row in obj["insights"]:
            if not isinstance(row, dict):
                continue
            c = row.get("category") or row.get("name")
            ins = row.get("insight") or row.get("why_points_off") or row.get("text")
            if isinstance(c, str) and isinstance(ins, str) and ins.strip():
                out[c] = ins.strip()
        return out
    if "items" in obj and isinstance(obj["items"], list):
        for row in obj["items"]:
            if not isinstance(row, dict):
                continue
            c = row.get("category") or row.get("name")
            ins = row.get("insight") or row.get("why_points_off")
            if isinstance(c, str) and isinstance(ins, str) and ins.strip():
                out[c] = ins.strip()
        return out
    for k, v in obj.items():
        if k in ("insights", "items", "status"):
            continue
        if isinstance(k, str) and isinstance(v, str) and v.strip():
            out[k] = v.strip()
    return out


def _llm_insights_for_gate(
    *,
    gate_name: str,
    rubric_text: str,
    category_stats: list[dict[str, Any]],
    model_name: str,
) -> dict[str, str] | None:
    """
    One LiteLLM call per gate. category_stats only rows with attempts > 0.
    """
    if not category_stats:
        return {}
    if not getattr(settings, "LITELLM_API_KEY", None):
        log.info("Score analysis LLM: LITELLM_API_KEY not set, skipping")
        return None
    system = (
        "You help instructors read aggregate scoring results for one rubric gate. "
        "For each category you receive numeric summaries only (no student text). "
        "Write one concise sentence per category on why students are most often "
        "not getting full points, or what is going well if most scores are at the maximum. "
        "Stay grounded in the numbers (attempts, perfect %, average vs max). "
        "Output ONLY valid JSON: "
        '{"insights": [{"category": "<exact name from input>", "insight": "<one sentence>"}]} '
        "The category value must match the input 'name' field exactly for each object."
    )
    user_payload: dict[str, Any] = {
        "scoring_gate": gate_name,
        "rubric_excerpt": _rubric_excerpt(rubric_text),
        "categories": category_stats,
    }
    user = json.dumps(user_payload, ensure_ascii=False)
    try:
        model_config = DynamicModelService.get_model_config(model_name)
        llm = UnifiedLLMInterface(model_config)
        api_params = llm.get_default_params(
            {
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "model": model_name,
                "temperature": 0.35,
                "max_tokens": 1200,
            }
        )
        res = llm.get_response(api_params)
        if not res.get("status"):
            log.warning("Score analysis LLM failed: %s", res.get("message"))
            return None
        text = (res.get("data") or {}).get("ai_response") or ""
        obj = _json_dict_from_text(text)
        if not obj:
            log.warning("Score analysis LLM: could not parse JSON from response")
            return None
        return _parse_llm_insights_payload(obj)
    except Exception as e:
        log.exception("Score analysis LLM error: %s", e)
        return None


def _apply_llm_or_heuristic(
    name: str,
    max_pt: float,
    values: list[float],
    perfect_pct: float,
    avg: float,
    llm_map: dict[str, str] | None,
) -> str:
    if llm_map is not None:
        got = _match_insight_by_name(name, llm_map)
        if got:
            return got
    return _heuristic_insight(name, max_pt, values, perfect_pct, avg)


def _runs_lack_per_criterion_breakdown(g_runs: list) -> bool:
    """True when no stored run has per-row scores (only totals or unparseable)."""
    if not g_runs:
        return False
    for r in g_runs:
        d = coerce_run_score_to_dict(r.run_score)
        if not d:
            t = parse_run_score_total(r.run_score)
            d = {"total": float(t)} if t is not None else {}
        if _per_criterion_score_keys(d):
            return False
    return True


def _insight_no_per_criterion_stored() -> str:
    return (
        "No per-criterion scores are stored for these runs—only a total (or text the "
        "server could not parse as JSON with one key per rubric row). The grader must "
        "return an object with the same labels as the rubric categories plus \"total\"."
    )


def _score_analysis_runs_fingerprint(app_id: int, rubric_version_id: int) -> str:
    row = (
        Run.objects.filter(
            ma_id=app_id,
            rubric_version_id=rubric_version_id,
            is_preview=False,
            scored_run=True,
        ).aggregate(
            c=Count("id"),
            max_id=Max("id"),
            max_u=Max("updated_at"),
        )
    )
    c = row["c"] or 0
    max_id = row["max_id"] or 0
    max_u = row["max_u"]
    u_part = max_u.isoformat() if max_u else ""
    return f"{c}:{max_id}:{u_part}"


def _score_analysis_insight_config_fingerprint() -> str:
    return "|".join(
        [
            "1"
            if getattr(settings, "SCORE_ANALYSIS_INSIGHT_LLM_ENABLED", False)
            else "0",
            str(getattr(settings, "SCORE_ANALYSIS_INSIGHT_MODEL", "gpt-4o-mini")),
        ]
    )


def _rubric_definition_fingerprint(version: RubricVersion) -> str:
    raw = json.dumps(version.definition_json or {}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]


def score_analysis_snapshot_fingerprint(
    app_id: int,
    version: RubricVersion,
) -> str:
    return "|".join(
        [
            _score_analysis_runs_fingerprint(app_id, version.id),
            _score_analysis_insight_config_fingerprint(),
            _rubric_definition_fingerprint(version),
        ]
    )


def get_cached_score_analysis_payload(
    *,
    app_id: int,
    version: RubricVersion,
) -> dict[str, Any]:
    """
    Return build_score_analysis_payload result, reusing a DB row when runs and
    insight settings are unchanged.
    """
    full_fp = score_analysis_snapshot_fingerprint(app_id, version)
    snap = ScoreAnalysisSnapshot.objects.filter(rubric_version=version).first()
    if snap is not None and snap.source_fingerprint == full_fp:
        return snap.payload_json
    payload = build_score_analysis_payload(app_id=app_id, version=version)
    ScoreAnalysisSnapshot.objects.update_or_create(
        rubric_version=version,
        defaults={
            "source_fingerprint": full_fp,
            "payload_json": payload,
        },
    )
    return payload


def build_score_analysis_payload(
    *,
    app_id: int,
    version: RubricVersion,
) -> dict[str, Any]:
    """
    Return gates -> categories with attempts, % perfect, average, median, difficulty, and
    an insight per category (LiteLLM when enabled; else heuristic).

    Per category, **attempts** = runs that have a parsed score for that criterion;
    perfect %, average, and median use only those runs.
    """
    # Only runs explicitly tied to this rubric version snapshot.
    runs = Run.objects.filter(
        ma_id=app_id,
        rubric_version=version,
        is_preview=False,
        scored_run=True,
    )

    definition = version.definition_json or {}
    if not (definition.get("gates") or []):
        return {
            "rubric_version_id": version.id,
            "version_number": version.version_number,
            "label": version.label or f"Version {version.version_number}",
            "scored_runs": runs.count(),
            "gates": [],
        }

    by_gate: dict[str, list[Run]] = {}
    for run in runs.iterator(chunk_size=500):
        # Same storage shapes as the rest of the app: dict, or grader string with prose
        # + fenced JSON (json.loads on the whole string fails; see score_utils).
        score_map = coerce_run_score_to_dict(run.run_score)
        if not score_map:
            t = parse_run_score_total(run.run_score)
            if t is not None:
                score_map = {"total": float(t)}
        if not score_map:
            continue
        gate = find_gate_for_run_rubric(definition, str(run.rubric or ""))
        if gate is None:
            continue
        gname = gate.get("name") or "scoring"
        if gname not in by_gate:
            by_gate[gname] = []
        by_gate[gname].append(run)

    out_gates: list[dict[str, Any]] = []

    for gdef in definition.get("gates") or []:
        gname = (gdef or {}).get("name") or "scoring"
        g_runs = by_gate.get(gname) or []
        gate_attempts = len(g_runs)

        categories = gdef.get("categories") or []
        if not categories:
            continue

        n_cats = len(categories)
        cat_out: list[dict[str, Any]] = []
        for cat_idx, cat in enumerate(categories):
            cname = (cat or {}).get("name") or "Category"
            max_pt = float((cat or {}).get("max") or 0.0) or 0.0
            if max_pt <= 0:
                max_pt = 1.0

            values: list[float] = []
            perfects = 0
            for r in g_runs:
                d = coerce_run_score_to_dict(r.run_score)
                if not d:
                    t2 = parse_run_score_total(r.run_score)
                    if t2 is not None:
                        d = {"total": float(t2)}
                fv = _score_value_for_criterion(
                    d, cname, cat_idx, n_cats
                )
                if fv is not None:
                    values.append(float(fv))
                    if fv >= max_pt - 1e-6:
                        perfects += 1

            n = len(values)
            perfect_pct = (100.0 * perfects / n) if n else 0.0
            avg = sum(values) / n if n else 0.0
            med = float(statistics.median(values)) if n else 0.0
            possible = max_pt

            cat_out.append(
                {
                    "name": cname,
                    "attempts": n,
                    "possible_points": possible,
                    "perfect_score_percent": round(perfect_pct, 1),
                    "average_score": round(avg, 2),
                    "median_score": round(med, 2),
                    "difficulty": _difficulty(perfect_pct),
                    "_max_pt": max_pt,
                    "_values": values,
                }
            )

        total_only = _runs_lack_per_criterion_breakdown(g_runs)

        llm_map: dict[str, str] | None = None
        if (
            not total_only
            and getattr(settings, "SCORE_ANALYSIS_INSIGHT_LLM_ENABLED", False)
        ):
            to_llm = [c for c in cat_out if c["attempts"] > 0]
            if to_llm:
                payload_stats = [
                    {
                        "name": c["name"],
                        "attempts": c["attempts"],
                        "possible_points": c["possible_points"],
                        "perfect_score_percent": c["perfect_score_percent"],
                        "average_score": c["average_score"],
                        "median_score": c["median_score"],
                        "difficulty": c["difficulty"],
                    }
                    for c in to_llm
                ]
                llm_map = _llm_insights_for_gate(
                    gate_name=gname,
                    rubric_text=(gdef or {}).get("rubric_text") or "",
                    category_stats=payload_stats,
                    model_name=getattr(
                        settings, "SCORE_ANALYSIS_INSIGHT_MODEL", "gpt-4o-mini"
                    ),
                )

        for item in cat_out:
            w = item.pop("_values", [])
            m = float(item.pop("_max_pt", 1.0))
            if not w and g_runs and total_only:
                item["insight"] = _insight_no_per_criterion_stored()
            else:
                item["insight"] = _apply_llm_or_heuristic(
                    item["name"],
                    m,
                    w,
                    item["perfect_score_percent"],
                    item["average_score"],
                    llm_map,
                )

        total_possible = sum(
            (float(c.get("max") or 0) or 0.0) for c in categories
        ) or 1.0
        gate_avg_totals: list[float] = []
        gate_perfects = 0
        for r in g_runs:
            d = coerce_run_score_to_dict(r.run_score)
            if not d:
                t2 = parse_run_score_total(r.run_score)
                if t2 is not None:
                    d = {"total": float(t2)}
            t = _to_float(d.get("total"))
            if t is not None:
                gate_avg_totals.append(t)
                if t >= float(total_possible) - 1e-6:
                    gate_perfects += 1
        g_n = len(gate_avg_totals)
        g_perfect = (100.0 * gate_perfects / g_n) if g_n else 0.0
        g_avg = sum(gate_avg_totals) / g_n if g_n else 0.0
        g_median = float(statistics.median(gate_avg_totals)) if g_n else 0.0

        out_gates.append(
            {
                "gate_name": gname,
                "attempts": gate_attempts,
                "possible_points": round(total_possible, 2),
                "perfect_score_percent": round(g_perfect, 1),
                "average_score": round(g_avg, 2),
                "median_score": round(g_median, 2),
                "difficulty": _difficulty(g_perfect),
                "categories": cat_out,
            }
        )

    return {
        "rubric_version_id": version.id,
        "version_number": version.version_number,
        "label": version.label or f"Version {version.version_number}",
        "scored_runs": runs.count(),
        "gates": out_gates,
    }


def list_versions_for_app(app_id: int) -> list[dict[str, Any]]:
    qs = (
        RubricVersion.objects.filter(ma_id=app_id)
        .annotate(
            scored_count=Count(
                "runs",
                filter=Q(
                    runs__is_preview=False,
                    runs__scored_run=True,
                ),
            )
        )
        .order_by("version_number", "id")
    )
    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "label": v.label or f"Version {v.version_number}",
            "scored_run_count": v.scored_count,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in qs
    ]
