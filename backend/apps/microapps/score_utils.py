"""
Parse numeric totals from Run.run_score (JSONField).

Models may store the raw LLM string (prose + fenced JSON) instead of a dict;
pass/fail logic and analytics need a consistent numeric total.
"""

from __future__ import annotations

import json
import re
from typing import Any, Optional

_TOTAL_IN_JSON_RE = re.compile(r'"total"\s*:\s*"?([\d.]+)"?', re.IGNORECASE)
_TOTAL_PROSE_RE = re.compile(r"\btotal\s*:\s*([\d.]+)\b", re.IGNORECASE)
_FENCED_JSON_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
_RESERVED_SCORE_KEYS = frozenset({"total", "overall_rationale", "score", "rationale"})
_OVERALL_RATIONALE_RE = re.compile(
    r'"overall_rationale"\s*:\s*"((?:[^"\\]|\\.)*)"',
    re.DOTALL,
)
_NESTED_CRITERION_RE = re.compile(
    r'"([^"\\]+)"\s*:\s*\{\s*"score"\s*:\s*([\d.]+)'
    r'(?:\s*,\s*"rationale"\s*:\s*"((?:[^"\\]|\\.)*)")?',
    re.DOTALL,
)
_FLAT_CRITERION_RE = re.compile(r'"([^"\\]+)"\s*:\s*([\d.]+)(?=\s*[,}])')


def _coerce_total_value(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None


def parse_run_score_total(run_score: Any) -> Optional[float]:
    """
    Best-effort extraction of the rubric total from stored run_score.

    Accepts dict (structured JSON), numeric, or string (including markdown + JSON).
    """
    if run_score is None:
        return None
    if isinstance(run_score, bool):
        return None
    if isinstance(run_score, (int, float)):
        return float(run_score)
    if isinstance(run_score, dict):
        return _coerce_total_value(run_score.get("total"))
    if not isinstance(run_score, str):
        return None

    text = run_score.strip()
    if not text:
        return None

    for m in _FENCED_JSON_RE.finditer(text):
        chunk = m.group(1).strip()
        try:
            obj = json.loads(chunk)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            v = _coerce_total_value(obj.get("total"))
            if v is not None:
                return v

    brace_start = text.rfind("{")
    if brace_start != -1:
        tail = text[brace_start:]
        for end in range(len(tail), 0, -1):
            snippet = tail[:end]
            try:
                obj = json.loads(snippet)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                v = _coerce_total_value(obj.get("total"))
                if v is not None:
                    return v
            break

    m = _TOTAL_IN_JSON_RE.search(text)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    m = _TOTAL_PROSE_RE.search(text)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    return None


def _dict_from_string_best_effort(text: str) -> dict[str, Any] | None:
    """
    Extract a single JSON object from a raw grader string (prose, fences, or trailing {…}).
    Used for per-criterion analytics; mirrors the extraction strategy of parse_run_score_total.
    """
    text = (text or "").strip()
    if not text:
        return None
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    for m in _FENCED_JSON_RE.finditer(text):
        chunk = m.group(1).strip()
        try:
            obj = json.loads(chunk)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            continue
    brace_start = text.rfind("{")
    if brace_start != -1:
        tail = text[brace_start:]
        for end in range(len(tail), 0, -1):
            snippet = tail[:end]
            try:
                obj = json.loads(snippet)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                return obj
    return None


def coerce_criterion_score(value: Any) -> Optional[float]:
    """Extract a numeric criterion score from a flat or nested grader value."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    if isinstance(value, dict):
        if "score" in value:
            return coerce_criterion_score(value.get("score"))
    return None


def parse_partial_run_score(text: str) -> dict[str, Any]:
    """
    Best-effort extraction from a streaming or incomplete grader JSON string.
    Returns criterion keys with flat numbers or nested {score, rationale} objects.
    """
    complete = _dict_from_string_best_effort(text)
    if complete:
        return complete

    result: dict[str, Any] = {}

    m = _TOTAL_IN_JSON_RE.search(text)
    if m:
        try:
            result["total"] = float(m.group(1))
        except ValueError:
            pass

    overall_m = _OVERALL_RATIONALE_RE.search(text)
    if overall_m:
        result["overall_rationale"] = (
            overall_m.group(1)
            .replace('\\"', '"')
            .replace("\\n", "\n")
            .replace("\\t", "\t")
        )

    for m in _NESTED_CRITERION_RE.finditer(text):
        key, score_str, rationale = m.groups()
        if key.strip().lower() in _RESERVED_SCORE_KEYS:
            continue
        entry: dict[str, Any] = {"score": float(score_str)}
        if rationale is not None:
            entry["rationale"] = (
                rationale.replace('\\"', '"').replace("\\n", "\n").replace("\\t", "\t")
            )
        result[key] = entry

    for m in _FLAT_CRITERION_RE.finditer(text):
        key, val = m.groups()
        k = key.strip()
        if k.lower() in _RESERVED_SCORE_KEYS:
            if k.lower() == "total" and "total" not in result:
                try:
                    result["total"] = float(val)
                except ValueError:
                    pass
            continue
        if k not in result:
            try:
                result[k] = float(val)
            except ValueError:
                pass

    return result


def format_run_score_feedback_from_rationales(score_map: dict[str, Any]) -> str:
    """Synthesize markdown feedback for stats/conversation views from nested scores."""
    lines: list[str] = []
    overall = score_map.get("overall_rationale")
    if isinstance(overall, str) and overall.strip():
        lines.append(overall.strip())
    for key, value in score_map.items():
        if str(key).strip().lower() in _RESERVED_SCORE_KEYS:
            continue
        if not isinstance(value, dict):
            continue
        rationale = value.get("rationale")
        if isinstance(rationale, str) and rationale.strip():
            lines.append(f"**{key}:** {rationale.strip()}")
    return "\n\n".join(lines)


def normalize_run_score_for_storage(run_score: Any) -> Any:
    """Prefer a parsed dict for JSONField storage; fall back to the raw value."""
    if isinstance(run_score, dict):
        return run_score
    parsed = coerce_run_score_to_dict(run_score)
    return parsed if parsed else run_score


def coerce_run_score_to_dict(run_score: Any) -> dict[str, Any]:
    """
    Best-effort dict for analytics (per-criterion keys + total), matching how the UI
    can show a breakdown. Handles JSONField dict, a bare number, or the raw grader
    string (often prose + ```json { … } ```), which json.loads on the full string
    cannot parse.
    """
    if run_score is None:
        return {}
    if isinstance(run_score, bool):
        return {}
    if isinstance(run_score, dict):
        return run_score
    if isinstance(run_score, (int, float)):
        return {"total": float(run_score)}
    if not isinstance(run_score, str):
        return {}
    d = _dict_from_string_best_effort(run_score)
    return d if d is not None else {}
