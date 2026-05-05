import json
import logging
from typing import Any, Dict, List

from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.llm_interface import UnifiedLLMInterface

log = logging.getLogger(__name__)

THEMES_MODEL = "gpt-4o-mini"
MAX_THEMES = 6


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return str(value)


def build_conversation_digest(runs: List[Any]) -> str:
    lines: List[str] = []
    for run in runs:
        user_text = _to_text(getattr(run, "user_prompt", ""))
        ai_text = _to_text(getattr(run, "response", ""))
        if not user_text and not ai_text:
            continue
        lines.append(f"User: {user_text}\nAssistant: {ai_text}")
    return "\n\n".join(lines)


def parse_themes_response(raw_response: str) -> List[Dict[str, str]]:
    text = (raw_response or "").strip()
    if not text:
        return []

    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx : end_idx + 1]

    payload = json.loads(text)
    themes = payload.get("themes", []) if isinstance(payload, dict) else []
    if not isinstance(themes, list):
        return []

    normalized: List[Dict[str, str]] = []
    for item in themes[:MAX_THEMES]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        description = str(item.get("description", "")).strip()
        if not title or not description:
            continue
        normalized.append({"title": title, "description": description})
    return normalized


def generate_themes(conversation_digest: str) -> List[Dict[str, str]]:
    system_message = (
        "You extract themes about how users interact with the app from chat transcripts.\n"
        "Prioritize: (1) how most users typically use the app (dominant paths and behaviors); "
        "(2) where users struggle—confusion, frustration, hesitation, abandonments, repeated "
        "questions, or circumvention; "
        "(3) where interactions look aligned with what the app was built for; "
        "(4) where users diverge from that intended use (workarounds, novel uses, misuse).\n"
        "Each theme must clearly tie to observed user behavior in the excerpts.\n"
        "Start exactly one theme title with 'Users typically' and another with 'Users struggle'."
        "Return ONLY valid JSON with this exact shape:\n"
        '{"themes":[{"title":"1-8 word title","description":"One sentence description"}]}\n'
        f"Rules:\n- Max {MAX_THEMES} themes\n- Merge overlapping themes\n"
        "- Title must be 1 to 8 words\n- Description must be one sentence\n"
        "- No markdown, no extra keys, no prose outside JSON"
    )

    user_message = (
        "From the excerpts below, produce themes focused on interaction patterns: typical use, "
        "struggle signals, fit with intended purpose, and deviation from it.\n\n"
        f"{conversation_digest}"
    )

    model_config = DynamicModelService.get_model_config(THEMES_MODEL)
    llm = UnifiedLLMInterface(model_config)
    api_params = llm.get_default_params(
        {
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "model": THEMES_MODEL,
            "temperature": 0.2,
            "max_tokens": 1000,
        }
    )
    response = llm.get_response(api_params)
    if not response.get("status"):
        log.error(
            "LLM theme generation failed model=%s detail=%s",
            THEMES_MODEL,
            response.get("message", response),
        )
        raise RuntimeError("LLM theme generation failed")
    ai_response = response["data"]["ai_response"]
    themes = parse_themes_response(ai_response)
    return themes[:MAX_THEMES]


def generate_themes_incremental(
    existing_themes: List[Dict[str, str]],
    new_conversation_digest: str,
) -> List[Dict[str, str]]:
    normalized_existing = [
        {
            "title": str(theme.get("title", "")).strip(),
            "description": str(theme.get("description", "")).strip(),
        }
        for theme in (existing_themes or [])
        if isinstance(theme, dict)
    ]
    existing_json = json.dumps(normalized_existing[:MAX_THEMES], ensure_ascii=False)

    system_message = (
        "You maintain themes about how users interact with the app, updating from new chats.\n"
        "Themes should reflect: typical usage across users; struggle (confusion, frustration, "
        "avoidance, retries); alignment with intended app purpose; divergence or workarounds.\n"
        "Start exactly one theme title with 'Users typically' and another with 'Users struggle'."
        "Return ONLY valid JSON with this exact shape:\n"
        '{"themes":[{"title":"1-8 word title","description":"One sentence description"}]}\n'
        f"Rules:\n- Max {MAX_THEMES} themes\n- Merge overlapping themes\n"
        "- Keep or refine themes when still supported by evidence\n"
        "- Add or drop themes based primarily on NEW conversations; reconcile with the snapshot\n"
        "- Title must be 1 to 8 words\n- Description must be one sentence\n"
        "- No markdown, no extra keys, no prose outside JSON"
    )
    user_message = (
        "Current themes snapshot (interaction-focused):\n"
        f"{existing_json}\n\n"
        "New conversations since last snapshot:\n"
        f"{new_conversation_digest}\n\n"
        "Update the list so it still captures dominant use, user struggles, fit with intended use, "
        "and deviations—grounded in the new excerpts."
    )

    model_config = DynamicModelService.get_model_config(THEMES_MODEL)
    llm = UnifiedLLMInterface(model_config)
    api_params = llm.get_default_params(
        {
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "model": THEMES_MODEL,
            "temperature": 0.2,
            "max_tokens": 1000,
        }
    )
    response = llm.get_response(api_params)
    if not response.get("status"):
        log.error(
            "LLM incremental theme generation failed model=%s detail=%s",
            THEMES_MODEL,
            response.get("message", response),
        )
        raise RuntimeError("LLM incremental theme generation failed")
    ai_response = response["data"]["ai_response"]
    themes = parse_themes_response(ai_response)
    return themes[:MAX_THEMES]
