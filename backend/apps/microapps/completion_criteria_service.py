"""
Evaluate chat completion criteria against a finished chat run's transcript.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Tuple

from django.conf import settings

from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.llm_interface import UnifiedLLMInterface

log = logging.getLogger(__name__)

DEFAULT_COMPLETION_CRITERIA_MODEL = "gemini-3-flash-preview"
MAX_CRITERIA = 20


def get_completion_criteria_model() -> str:
    return str(
        getattr(
            settings,
            "COMPLETION_CRITERIA_MODEL",
            DEFAULT_COMPLETION_CRITERIA_MODEL,
        )
        or DEFAULT_COMPLETION_CRITERIA_MODEL
    )


def _message_content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    parts.append(text)
            elif isinstance(item, dict):
                if item.get("type") == "text":
                    text = str(item.get("text") or "").strip()
                    if text:
                        parts.append(text)
                elif "text" in item:
                    text = str(item.get("text") or "").strip()
                    if text:
                        parts.append(text)
        return "\n".join(parts)
    try:
        return json.dumps(content, ensure_ascii=False)
    except Exception:
        return str(content)


def build_conversation_transcript(api_messages: Any, assistant_response: Any) -> str:
    """
    Build a readable transcript from the run's stored api_messages plus response.
    Prefers user/assistant turns; skips system messages.
    """
    lines: List[str] = []
    messages = api_messages if isinstance(api_messages, list) else []

    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "").strip().lower()
        if role not in ("user", "assistant"):
            continue
        text = _message_content_to_text(message.get("content"))
        if not text or text == ".":
            continue
        label = "User" if role == "user" else "Assistant"
        lines.append(f"{label}: {text}")

    response_text = _message_content_to_text(assistant_response)
    if response_text:
        last = lines[-1] if lines else ""
        expected = f"Assistant: {response_text}"
        if last != expected:
            lines.append(expected)

    return "\n\n".join(lines).strip()


def normalize_criteria(raw_criteria: Any) -> List[Dict[str, str]]:
    if not isinstance(raw_criteria, list):
        return []

    normalized: List[Dict[str, str]] = []
    seen_ids = set()
    for item in raw_criteria:
        if not isinstance(item, dict):
            continue
        criterion_id = str(item.get("id") or "").strip()
        text = str(item.get("text") or "").strip()
        if not criterion_id or not text:
            continue
        if criterion_id in seen_ids:
            continue
        seen_ids.add(criterion_id)
        normalized.append({"id": criterion_id, "text": text})
        if len(normalized) >= MAX_CRITERIA:
            break
    return normalized


def parse_completion_results(
    raw_response: str,
    criterion_ids: List[str],
) -> Dict[str, bool]:
    """
    Parse model JSON into a boolean map for every requested criterion id.
    Missing or non-boolean values become False.
    """
    results = {criterion_id: False for criterion_id in criterion_ids}
    text = (raw_response or "").strip()
    if not text:
        return results

    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx : end_idx + 1]

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        log.warning("Completion criteria response was not valid JSON")
        return results

    raw_results = payload.get("results", payload) if isinstance(payload, dict) else {}
    if not isinstance(raw_results, dict):
        return results

    for criterion_id in criterion_ids:
        value = raw_results.get(criterion_id)
        if isinstance(value, bool):
            results[criterion_id] = value
        elif isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in ("true", "yes", "1"):
                results[criterion_id] = True
            elif lowered in ("false", "no", "0"):
                results[criterion_id] = False

    return results


def evaluate_completion_criteria(
    transcript: str,
    criteria: List[Dict[str, str]],
) -> Tuple[Dict[str, bool], float, int]:
    """
    Ask the configured cheap model whether each criterion is currently true.

    Returns (results, cost, credits). Raises on LLM failure.
    """
    if not transcript.strip():
        raise ValueError("Conversation transcript is empty")
    if not criteria:
        raise ValueError("No completion criteria provided")

    criteria_block = "\n".join(
        f'- id="{item["id"]}": {item["text"]}' for item in criteria
    )
    id_list = ", ".join(f'"{item["id"]}"' for item in criteria)

    system_message = (
        "You evaluate yes/no completion criteria against a chat transcript.\n"
        "Judge the conversation as it stands now — not only the latest turn.\n"
        "A criterion is true only when the transcript clearly supports it; "
        "otherwise it is false. Criteria may become false again if later turns "
        "contradict earlier evidence.\n"
        "Return ONLY valid JSON with this exact shape:\n"
        '{"results":{"<criterion_id>":true}}\n'
        f"Include a boolean for every id in this list: [{id_list}].\n"
        "No markdown, no extra keys, no prose outside JSON."
    )
    user_message = (
        "Completion criteria:\n"
        f"{criteria_block}\n\n"
        "Conversation transcript:\n"
        f"{transcript}"
    )

    model_name = get_completion_criteria_model()
    model_config = DynamicModelService.get_model_config(model_name)
    llm = UnifiedLLMInterface(model_config)
    api_params = llm.get_default_params(
        {
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "model": model_name,
            "temperature": 0.1,
            "max_tokens": 500,
        }
    )
    response = llm.get_response(api_params)
    if not response.get("status"):
        log.error(
            "Completion criteria LLM failed model=%s detail=%s",
            model_name,
            response.get("message", response),
        )
        raise RuntimeError("Completion criteria evaluation failed")

    data = response.get("data") or {}
    ai_response = data.get("ai_response") or ""
    cost = float(data.get("cost") or 0)
    credits = int(data.get("credits") or 0)
    results = parse_completion_results(
        ai_response,
        [item["id"] for item in criteria],
    )
    return results, cost, credits
