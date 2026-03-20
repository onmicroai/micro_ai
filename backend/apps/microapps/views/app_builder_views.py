import asyncio
import os
import json
import logging
import re
import requests
from pathlib import Path

import environ
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.microapps.models import Microapp, MicroAppUserJoin
from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.llm_interface import UnifiedLLMInterface

log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))

# Models used for each pipeline stage — admin-configured, not user-selectable
GUARD_MODEL = "gemini-3-flash-preview"
BUILD_MODEL = "claude-sonnet-4-6"
BUILD_MAX_TOKENS = 16000
THINKING_BUDGET_TOKENS = 10000

GUARD_SYSTEM_PROMPT = """You are a classifier for an AI microapp builder assistant.

Your sole job is to determine whether a user's message is about building or modifying a microapp.

A message is ALLOWED if it is about:
- Creating a new app or modifying an existing one
- Adding, removing, or editing questions/elements
- Changing app settings (title, description, privacy, AI model, system prompt, etc.)
- Adjusting rubrics, scoring, or conditional logic
- Any structural change to the app JSON

A message is REFUSED if it is:
- A general knowledge question unrelated to app building
- A question about how to use the platform (documentation)
- Off-topic or conversational
- Asking for help with something outside of microapp construction

Respond with ONLY the single word: ALLOWED or REFUSED"""

SCHEMA_REFERENCE = """# Microapp JSON Schema Reference

This document gives an AI everything it needs to generate syntactically correct app_json for creating microapps. The backend stores app_json as a JSON field and is schema-agnostic — the frontend owns this contract.

## Top-Level Shape

{
  "title": "My App Title",
  "description": "A short description of what this app does.",
  "privacySettings": "private",
  "clonable": true,
  "completedHtml": "You've reached the end",
  "aiConfig": {
    "aiModel": "gpt-4o-mini",
    "temperature": 0.7,
    "maxResponseTokens": null,
    "systemPrompt": ""
  },
  "attachedFiles": [],
  "elements": []
}

### Top-Level Fields
- title (string, required): Shown on dashboard and top of app
- description (string, optional): Shown below title on run screen
- privacySettings ("public" | "private" | "restricted", optional): Default: "private"
- clonable (boolean, optional): Whether other users can clone this app
- completedHtml (string, optional): Message shown when app is complete
- aiConfig (AIConfig object, optional): App-wide AI settings
- attachedFiles (AttachedFile[], optional): Files attached to the app for AI context
- elements (Element[], required): Ordered list of all elements

### AIConfig Object
{
  "aiModel": "gpt-4o-mini",
  "temperature": 0.7,
  "maxResponseTokens": null,
  "systemPrompt": ""
}

## Elements Array

The elements array is the heart of an app. Elements are rendered top-to-bottom in the order they appear.

Element ID Convention: IDs follow the pattern {type}-{timestamp} where timestamp is a Unix millisecond integer.

All element types:
- Input: text | textarea | radio | checkbox | dropdown | slider | boolean | richText | chat | imageUpload
- Structural: title | aiResponse | fixedResponse | scoring

### All Input Elements Share These Core Fields:
- id (string, required): Unique ID, e.g. "text-1700000000001"
- name (string, required): Variable name used in prompts via {name} interpolation
- type (ElementType, required): See type list above
- label (string, required): The question/label shown to the user
- isRequired (boolean, required): Whether the user must fill this field
- description (string, optional): Helper text shown below the label
- placeholder (string, optional): Placeholder text inside the input
- defaultValue (optional): Pre-filled value
- conditionalLogic (ConditionalLogic, optional): Show/hide this element based on another field's value

### text — Single-line text input
{
  "id": "text-1700000000001",
  "name": "student_name",
  "type": "text",
  "label": "What is your name?",
  "isRequired": true,
  "placeholder": "Enter your name..."
}
Additional fields: minChars, maxChars

### textarea — Multi-line text input
{
  "id": "textarea-1700000000002",
  "name": "essay_text",
  "type": "textarea",
  "label": "Paste your essay here:",
  "isRequired": true,
  "placeholder": "Enter text..."
}
Additional fields: minChars, maxChars

### radio — Single-choice selection
{
  "id": "radio-1700000000003",
  "name": "difficulty",
  "type": "radio",
  "label": "Select difficulty level:",
  "isRequired": false,
  "defaultValue": "Item 1",
  "choices": [
    { "text": "Easy", "value": "easy" },
    { "text": "Medium", "value": "medium" },
    { "text": "Hard", "value": "hard" }
  ],
  "showOtherItem": false
}

### checkbox — Multi-choice selection
Same structure as radio. Multiple selections join as comma-separated string.

### dropdown — Single-choice dropdown
Same structure as radio, renders as a select dropdown.

### slider — Numeric slider
{
  "id": "slider-1700000000006",
  "name": "num_questions",
  "type": "slider",
  "label": "Number of questions:",
  "isRequired": false,
  "minValue": 1,
  "maxValue": 10,
  "step": 1,
  "defaultValue": 3
}

### boolean — True/false toggle
{
  "id": "boolean-1700000000007",
  "name": "include_hints",
  "type": "boolean",
  "label": "Include hints for each question?",
  "isRequired": false,
  "defaultValue": false,
  "labelTrue": "Yes",
  "labelFalse": "No"
}
Note: When used in conditionalLogic, use true or false (boolean, not string) as the value.

### richText — Static HTML display (read-only)
{
  "id": "richText-1700000000008",
  "name": "instructions_block",
  "type": "richText",
  "label": "",
  "isRequired": false,
  "html": "<p>Please read the passage below carefully before answering.</p>"
}

### imageUpload — Image upload input
{
  "id": "imageUpload-1700000000009",
  "name": "my_image",
  "type": "imageUpload",
  "label": "Upload an image:",
  "isRequired": false,
  "multiple": true,
  "maxFiles": 3,
  "maxFileSize": 6,
  "allowedFileTypes": ["image/jpeg", "image/png"]
}

### chat — Chatbot interface
{
  "id": "chat-1700000000010",
  "name": "chat_session",
  "type": "chat",
  "label": "Chat with the AI tutor:",
  "isRequired": false,
  "initialMessage": "Hello! What would you like to learn today?",
  "chatbotInstructions": "You are a friendly tutor.",
  "maxMessages": 10,
  "avatarUrl": ""
}

## Structural / Output Element Types

### title — Section heading / divider
{
  "id": "title-1700000000011",
  "name": "section1_title",
  "type": "title",
  "label": "Step 1: Provide Your Content",
  "isRequired": false,
  "description": "Fill in the fields below to get started."
}

### aiResponse — AI-generated response (MOST IMPORTANT element)
This triggers an AI call and displays the response. The instructions array defines what gets sent.
User-provided values are injected using {field_name} placeholders.

{
  "id": "aiResponse-1700000000012",
  "name": "aiResponse1",
  "type": "aiResponse",
  "label": "",
  "isRequired": false,
  "instructions": [
    {
      "text": "You are an expert writing coach. Please review the following essay."
    },
    {
      "text": "The student grade level is {grade_level}.",
      "conditionalLogic": {
        "sourceFieldId": "dropdown-1700000000005",
        "operator": "is_not_empty"
      }
    },
    {
      "text": "Here is the essay:\\n\\n{essay_text}"
    }
  ]
}

instructions[] item fields:
- text (string): The prompt text. Use {field_name} to inject user values.
- conditionalLogic (ConditionalLogic, optional): Only include this instruction if condition is met.
All passing instructions are concatenated into a single prompt sent to the AI.

### fixedResponse — Static (non-AI) text display
{
  "id": "fixedResponse-1700000000013",
  "name": "fixedResponse1",
  "type": "fixedResponse",
  "label": "",
  "isRequired": false,
  "text": "Welcome, {student_name}! Let's begin your session."
}

### scoring — AI-scored assessment
{
  "id": "scoring-1700000000014",
  "name": "scoring1",
  "type": "scoring",
  "label": "",
  "isRequired": true,
  "rubric": "Clarity\\n2 points – The argument is clearly stated.\\n0 points – The argument is unclear.\\n\\nEvidence\\n3 points – At least two specific pieces of evidence are cited.\\n0 points – No specific evidence is cited.",
  "minScore": 4,
  "scoreFeedbackEnabled": false,
  "scoreFeedbackInstructions": ""
}

## Conditional Logic
"conditionalLogic": {
  "sourceFieldId": "radio-1700000000003",
  "operator": "equals",
  "value": "Medium"
}

Fields: sourceFieldId (id of the field to evaluate), operator, value (not required for is_empty / is_not_empty)

Available operators: equals, not_equals, contains, not_contains, is_empty, is_not_empty, greater_than, less_than, greater_than_or_equal, less_than_or_equal

Important: sourceFieldId must reference an element that appears BEFORE the current element.

## Value Interpolation in Prompts
Inside aiResponse instructions or fixedResponse text, use {field_name} to inject user values.
Examples: "Please write {num_questions} questions about {topic}."

## Rules Summary
1. Element id values must be unique; use the {type}-{timestamp} convention.
2. Element name values must be unique and contain only alphanumeric characters and underscores.
3. aiResponse instructions are concatenated in order; put context first and user content last.
4. conditionalLogic.sourceFieldId must reference the id of an element that appears BEFORE it.
5. For boolean conditional values, use JSON true/false, not "true"/"false" strings.
6. scoring elements require a rubric string describing each criterion and its point values."""

BUILD_SYSTEM_PROMPT = """You are an expert microapp builder AI. Your job is to create or modify microapp JSON based on user instructions.

=== MICROAPP JSON SCHEMA ===
{schema}
=== END SCHEMA ===

=== CURRENT APP JSON ===
{current_app_json}
=== END CURRENT APP JSON ===

You MUST follow this exact response format — no exceptions:

1. PLAN: Write 1-3 sentences describing what you are going to do, using bullet points if appropriate. Write this in non-technical language. Do not mention the JSON format. Do not mention the schema.

2. JSON: Output the complete, valid app_json wrapped in a ```json code fence like this:
```json
{{ ... }}
```

3. SUMMARY: Write 1-3 sentences summarising what was done.

Rules for the JSON block:
- The JSON must follow the schema exactly.
- If the user asks to create a new app, build it from scratch.
- If the user asks to modify the existing app, make only the requested changes and preserve all other content.
- Generate unique IDs using the {{type}}-{{timestamp}} convention (e.g. "text-1700000000001", incrementing by 1).
- Element names must be unique and alphanumeric with underscores only."""


class AppBuilderChatView(APIView):
    """Three-stage pipeline: guard → build (streaming + thinking) → validate."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        app_id = request.data.get("app_id")
        message = request.data.get("message", "").strip()
        history = request.data.get("history", [])

        if not app_id or not message:
            return Response(
                {"error": "app_id and message are required"},
                status=400,
            )

        try:
            microapp = Microapp.objects.get(id=app_id)
        except Microapp.DoesNotExist:
            return Response({"error": "App not found"}, status=404)

        # Verify the requesting user has access to this app
        has_access = MicroAppUserJoin.objects.filter(
            ma_id=microapp, user_id=request.user
        ).exists()
        if not has_access:
            return Response({"error": "Access denied"}, status=403)

        # Build the messages list here so the async generator can close over it.
        current_app_json = microapp.app_json or {}
        current_app_json_str = json.dumps(current_app_json, indent=2)
        system_prompt = BUILD_SYSTEM_PROMPT.format(
            schema=SCHEMA_REFERENCE,
            current_app_json=current_app_json_str,
        )
        llm_messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            if h.get("role") in ("user", "assistant") and h.get("content"):
                llm_messages.append({"role": h["role"], "content": h["content"]})
        llm_messages.append({"role": "user", "content": message})

        # Sentinel used to detect StopIteration from run_in_executor safely
        _DONE = object()

        def _next_or_done(gen):
            try:
                return next(gen)
            except StopIteration:
                return _DONE

        async def sse_stream():
            loop = asyncio.get_event_loop()

            # --- Stage 1: Guard (blocking, run in thread) ---
            try:
                verdict = await loop.run_in_executor(None, self._run_guard, message)
            except Exception as e:
                log.error(f"App builder guard stage error: {e}")
                yield f"event: error\ndata: {json.dumps({'message': 'An error occurred while processing your request. Please try again.'})}\n\n"
                return

            if verdict == "REFUSED":
                refusal = (
                    "I'm designed specifically to help you build and modify microapps. "
                    "I can help you create questions, adjust rubrics, add elements, configure AI responses, and more. "
                    "Please ask me something related to building your app!"
                )
                yield f"event: refused\ndata: {json.dumps({'message': refusal})}\n\n"
                return

            # --- Stage 2: Build (stream each chunk via run_in_executor) ---
            json_accumulator = []
            build_gen = self._stream_build(llm_messages, json_accumulator)
            try:
                while True:
                    result = await loop.run_in_executor(
                        None, _next_or_done, build_gen
                    )
                    if result is _DONE:
                        break
                    event_type, chunk = result
                    if event_type == "thinking":
                        yield f"event: thinking\ndata: {json.dumps({'chunk': chunk})}\n\n"
                    elif event_type == "text":
                        yield f"event: content\ndata: {json.dumps({'chunk': chunk})}\n\n"
            except Exception as e:
                log.error(f"App builder build stage error: {e}")
                yield f"event: error\ndata: {json.dumps({'message': 'An error occurred while generating the app. Please try again.'})}\n\n"
                return

            # --- Stage 3: Validate ---
            raw_json = "".join(json_accumulator)
            try:
                app_json = self._extract_and_validate_json(raw_json)
                yield f"event: complete\ndata: {json.dumps({'app_json': app_json})}\n\n"
            except ValueError as e:
                log.error(f"App builder validation error: {e}")
                yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

        response = StreamingHttpResponse(
            sse_stream(),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

    def _run_guard(self, message: str) -> str:
        """Run the guard classifier. Returns 'ALLOWED' or 'REFUSED'."""
        model_config = DynamicModelService.get_model_config(GUARD_MODEL)
        llm = UnifiedLLMInterface(model_config)
        api_params = llm.get_default_params({
            "messages": [
                {"role": "system", "content": GUARD_SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
            "model": GUARD_MODEL,
            "temperature": 0,
            "max_tokens": 10,
        })
        response = llm.get_response(api_params)
        if not response.get("status"):
            raise Exception(f"Guard model failed: {response.get('message')}")

        answer = response["data"]["ai_response"].strip().upper()
        if "REFUSED" in answer:
            return "REFUSED"
        return "ALLOWED"

    def _stream_build(self, messages: list, json_accumulator: list):
        """
        Stream the build stage directly against the LiteLLM proxy with thinking enabled.

        Yields ("thinking" | "text", str) for content that should be shown to the user.
        JSON content inside ```json...``` fences is silently appended to json_accumulator
        instead of being yielded, so it never reaches the frontend as raw JSON.
        """
        OPEN_FENCE = "```json"
        CLOSE_FENCE = "```"

        url = f"{settings.LITELLM_BASE_URL}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.LITELLM_API_KEY}",
        }
        payload = {
            "model": BUILD_MODEL,
            "messages": messages,
            "max_tokens": BUILD_MAX_TOKENS,
            "stream": True,
            "thinking": {"type": "enabled", "budget_tokens": THINKING_BUDGET_TOKENS},
        }

        resp = requests.post(
            url, headers=headers, json=payload, stream=True, timeout=300
        )
        resp.raise_for_status()

        # Lookahead buffer for text outside JSON fences
        text_buf = ""
        in_json = False

        for line in resp.iter_lines():
            if not line:
                continue
            line_str = line.decode("utf-8")
            if not line_str.startswith("data: "):
                continue
            data_str = line_str[6:]
            if data_str.strip() == "[DONE]":
                break
            try:
                chunk = json.loads(data_str)
            except json.JSONDecodeError:
                continue

            delta = chunk.get("choices", [{}])[0].get("delta", {})

            thinking = delta.get("thinking", "")
            if thinking:
                yield ("thinking", thinking)

            raw = delta.get("content", "")
            if not raw:
                continue

            # Feed into the lookahead buffer and process
            text_buf += raw
            while True:
                if not in_json:
                    idx = text_buf.find(OPEN_FENCE)
                    if idx == -1:
                        # No opening fence yet; emit everything except a possible
                        # partial fence match at the very end of the buffer.
                        safe_len = max(0, len(text_buf) - len(OPEN_FENCE) + 1)
                        if safe_len > 0:
                            yield ("text", text_buf[:safe_len])
                            text_buf = text_buf[safe_len:]
                        break
                    else:
                        # Emit text before the fence, then enter JSON mode.
                        if idx > 0:
                            yield ("text", text_buf[:idx])
                        text_buf = text_buf[idx + len(OPEN_FENCE):]
                        # Skip a single optional newline after ```json
                        if text_buf.startswith("\n"):
                            text_buf = text_buf[1:]
                        in_json = True
                else:
                    idx = text_buf.find(CLOSE_FENCE)
                    if idx == -1:
                        # Still inside JSON; accumulate safely.
                        safe_len = max(0, len(text_buf) - len(CLOSE_FENCE) + 1)
                        if safe_len > 0:
                            json_accumulator.append(text_buf[:safe_len])
                            text_buf = text_buf[safe_len:]
                        break
                    else:
                        # Found closing fence; exit JSON mode.
                        json_accumulator.append(text_buf[:idx])
                        text_buf = text_buf[idx + len(CLOSE_FENCE):]
                        in_json = False

        # Flush whatever remains in the buffer after the stream ends.
        if text_buf.strip() and not in_json:
            yield ("text", text_buf.strip())
        elif text_buf and in_json:
            # Edge case: stream ended while still inside the JSON block.
            json_accumulator.append(text_buf)

    def _extract_and_validate_json(self, raw: str) -> dict:
        """Strip markdown fences if present, parse JSON, and verify basic structure."""
        text = raw.strip()

        # Strip markdown code fences if the model wrapped its output
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if fence_match:
            text = fence_match.group(1).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"The AI returned invalid JSON. Please try rephrasing your request. "
                f"(Detail: {e})"
            )

        if not isinstance(data, dict):
            raise ValueError(
                "The AI returned an unexpected format. Please try again."
            )

        if "elements" not in data or not isinstance(data["elements"], list):
            raise ValueError(
                "The generated app is missing a valid 'elements' array. Please try again."
            )

        return data
