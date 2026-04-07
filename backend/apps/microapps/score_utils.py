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
