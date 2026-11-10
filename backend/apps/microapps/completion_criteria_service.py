"""
Evaluate chat completion criteria against a finished chat run's transcript.

Uses TypeSafe Jev through LiteLLM's /v1/systemone endpoint: one noul (yes/no)
question per criterion, judged against the full conversation transcript.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Tuple

import requests
from django.conf import settings

from apps.utils.global_variables import UsageVariables

log = logging.getLogger(__name__)

DEFAULT_COMPLETION_CRITERIA_MODEL = "jev"
DEFAULT_TRUE_THRESHOLD = 0.5
MAX_CRITERIA = 20

try:
    from litellm import cost_per_token
except ImportError:
    cost_per_token = None


def get_completion_criteria_model() -> str:
    return str(
        getattr(
            settings,
            "COMPLETION_CRITERIA_MODEL",
            DEFAULT_COMPLETION_CRITERIA_MODEL,
        )
        or DEFAULT_COMPLETION_CRITERIA_MODEL
    )


def get_true_threshold() -> float:
    try:
        value = float(
            getattr(
                settings,
                "COMPLETION_CRITERIA_TRUE_THRESHOLD",
                DEFAULT_TRUE_THRESHOLD,
            )
        )
    except (TypeError, ValueError):
        return DEFAULT_TRUE_THRESHOLD
    if value < 0 or value > 1:
        return DEFAULT_TRUE_THRESHOLD
    return value


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


def build_systemone_questions(criteria: List[Dict[str, str]]) -> Dict[str, Any]:
    """One noul (yes/no) question per completion criterion."""
    questions: Dict[str, Any] = {}
    for item in criteria:
        questions[item["id"]] = {
            "type": "noul",
            "instructions": (
                "Judge the conversation as it stands now — not only the latest "
                "turn. Answer yes only when the transcript clearly supports this "
                "statement; otherwise answer no. A statement may become false "
                f'again if later turns contradict earlier evidence.\n\nStatement: {item["text"]}'
            ),
            "criteria": {
                "true": "The transcript clearly supports this statement right now",
                "false": (
                    "The transcript does not clearly support this statement, "
                    "or later turns contradict it"
                ),
            },
        }
    return questions


def parse_systemone_answers(
    payload: Any,
    criterion_ids: List[str],
    threshold: float,
) -> Dict[str, bool]:
    """
    Map System One noul answers to booleans.
    Missing or non-numeric probabilities become False.
    """
    results = {criterion_id: False for criterion_id in criterion_ids}
    if not isinstance(payload, dict):
        return results

    answers = payload.get("answers")
    if not isinstance(answers, dict):
        return results

    for criterion_id in criterion_ids:
        answer = answers.get(criterion_id)
        if not isinstance(answer, dict):
            continue
        probability = answer.get("noul")
        if probability is None:
            probability = answer.get("probability")
        try:
            results[criterion_id] = float(probability) >= threshold
        except (TypeError, ValueError):
            continue

    return results


def _usage_to_cost_and_credits(usage: Any, model_name: str, response_cost: Any) -> Tuple[float, int]:
    """Prefer LiteLLM's response cost header; otherwise price from token usage."""
    if response_cost is not None and response_cost != "":
        try:
            cost = round(float(response_cost), 6)
            credits = max(
                int(cost * UsageVariables.CREDITS_MULTIPLIER),
                UsageVariables.MINIMUM_CREDITS if cost > 0 else 0,
            )
            return cost, credits
        except (TypeError, ValueError):
            pass

    if cost_per_token is None or not isinstance(usage, dict):
        return 0.0, 0

    prompt_tokens = int(
        usage.get("prompt_tokens")
        or usage.get("input_tokens")
        or 0
    )
    completion_tokens = int(
        usage.get("completion_tokens")
        or usage.get("output_tokens")
        or 0
    )
    if prompt_tokens <= 0 and completion_tokens <= 0:
        return 0.0, 0

    # Registry prices live under the provider-prefixed name.
    pricing_model = (
        f"typesafe/{model_name}"
        if model_name.startswith("jev")
        else model_name
    )
    try:
        prompt_cost, completion_cost = cost_per_token(
            model=pricing_model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        cost = round(float(prompt_cost) + float(completion_cost), 6)
        credits = max(
            int(cost * UsageVariables.CREDITS_MULTIPLIER),
            UsageVariables.MINIMUM_CREDITS if cost > 0 else 0,
        )
        return cost, credits
    except Exception as e:
        log.warning("Completion criteria cost calculation failed: %s", e)
        return 0.0, 0


def evaluate_completion_criteria(
    transcript: str,
    criteria: List[Dict[str, str]],
) -> Tuple[Dict[str, bool], float, int]:
    """
    Ask Jev whether each criterion is currently true via /v1/systemone.

    Returns (results, cost, credits). Raises on request failure.
    """
    if not transcript.strip():
        raise ValueError("Conversation transcript is empty")
    if not criteria:
        raise ValueError("No completion criteria provided")

    model_name = get_completion_criteria_model()
    threshold = get_true_threshold()
    payload = {
        "model": model_name,
        "state": (
            "Chat transcript to evaluate for completion criteria:\n\n"
            f"{transcript}"
        ),
        "questions": build_systemone_questions(criteria),
    }

    url = f"{settings.LITELLM_BASE_URL.rstrip('/')}/v1/systemone"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        log.error(
            "Completion criteria Jev call failed model=%s detail=%s",
            model_name,
            e,
        )
        raise RuntimeError("Completion criteria evaluation failed") from e

    results = parse_systemone_answers(
        data,
        [item["id"] for item in criteria],
        threshold,
    )
    cost, credits = _usage_to_cost_and_credits(
        data.get("usage") if isinstance(data, dict) else None,
        model_name,
        response.headers.get("x-litellm-response-cost"),
    )
    return results, cost, credits
