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


def _json_root_object_end_index(s: str, start: int = 0) -> int:
    """
    Return the index of the `}` that closes the root JSON object starting at
    `start`, or -1 if the object is incomplete or `start` is not `{`.

    Respects JSON strings so `{`, `}`, and backticks inside string values do not
    affect brace depth.
    """
    if start >= len(s) or s[start] != "{":
        return -1
    depth = 1
    i = start + 1
    in_string = False
    escape = False
    while i < len(s):
        c = s[i]
        if in_string:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def _find_root_json_span(text: str) -> tuple[int, int] | None:
    """
    If `text` contains a complete root JSON object starting at the first `{`,
    return (start, end) slice indices with end exclusive. Otherwise None.
    """
    ls = text.lstrip()
    if not ls.startswith("{"):
        return None
    lead = len(text) - len(ls)
    end_rel = _json_root_object_end_index(ls, 0)
    if end_rel < 0:
        return None
    return (lead, lead + end_rel + 1)


def _stringify_chat_completion_content(value) -> str:
    """
    Normalize `choices[].delta.content` / `message.content` to a string.

    OpenAI-compatible APIs may return a list of parts, e.g.
    [{"type": "text", "text": "..."}], which is falsy in Python if assigned
    directly and skipped with `if not content` — yielding an empty accumulator.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, dict):
                if item.get("type") == "text" and "text" in item:
                    parts.append(str(item.get("text") or ""))
                elif "text" in item:
                    parts.append(str(item.get("text") or ""))
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    return str(value)


def _streaming_assistant_text_chunk(chunk: dict) -> str:
    """Best-effort assistant text from one SSE JSON chunk (delta + optional message)."""
    choice = (chunk.get("choices") or [{}])[0]
    delta = choice.get("delta") or {}
    text = _stringify_chat_completion_content(delta.get("content"))
    if text:
        return text
    message = choice.get("message") or {}
    return _stringify_chat_completion_content(message.get("content"))


# Opening fence: allow spaces (``` json), case-insensitive "json", reject ```jsonl, etc.
_OPEN_JSON_FENCE_START = re.compile(r"```\s*json(?![a-zA-Z])", re.IGNORECASE)
# Keep a suffix long enough for a partial ```\s*json at buffer end when streaming.
_OPEN_JSON_FENCE_LOOKBACK = 24


def _sse_status_event(stage: str, message: str) -> str:
    """Format an SSE `status` event (stage + user-facing message)."""
    return f"event: status\ndata: {json.dumps({'stage': stage, 'message': message})}\n\n"


def _consume_outer_json_markdown_close_fence(text: str) -> int | None:
    """
    After the root JSON object, the model closes the ```json fence with a line
    that is only ``` (optional spaces), not ```python etc.

    Returns the number of characters to remove from the front of `text` if a
    complete closing fence is present. Returns None if `text` may be an
    incomplete prefix of such a fence (caller should wait for more streamed
    bytes).
    """
    m = re.match(r"^\s*```[ \t]*(?:\r?\n|\Z)", text)
    if m:
        return m.end()
    # Another ```lang block should not appear here; if it does, do not wait forever.
    if re.match(r"^\s*```[A-Za-z]", text):
        return 0
    t = text.lstrip()
    if not t:
        return None
    if re.match(r"^\s*`{1,2}\Z", text):
        return None
    if re.match(r"^\s*```[ \t]*\Z", text) and not text.endswith(("\n", "\r")):
        return None
    return 0


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
    "aiModel": "claude-haiku-4-5-20251001",
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
  "aiModel": "claude-haiku-4-5-20251001",
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

The chat element supports two distinct modes. Choose based on the use case.

**Mode A: Simple / informational chatbot** — A free-form assistant the learner converses with. Used for Q&A against a document, a study assistant, a help bot, or any open-ended support scenario. chatbotInstructions is a plain system prompt with no special structure required.

{
  "id": "chat-1700000000010",
  "name": "study_chat",
  "type": "chat",
  "label": "Ask a question about the reading:",
  "isRequired": false,
  "initialMessage": "Hi! I'm here to help you with Chapter 3. What questions do you have?",
  "chatbotInstructions": "You are a helpful study assistant for this course. Answer questions about the assigned reading clearly and concisely. If a question is outside the scope of the material, say so and redirect the learner.",
  "maxMessages": 10,
  "avatarUrl": ""
}

**Mode B: Character simulation** — The AI plays a specific character in a defined scenario. The learner practices a real-world skill through open-ended dialogue (interviewing, negotiating, counseling, pitching, etc.). chatbotInstructions uses ## markdown headers.

{
  "id": "chat-1700000000010",
  "name": "simulation1",
  "type": "chat",
  "label": "Chat with Margaret:",
  "isRequired": false,
  "initialMessage": "Hi… sorry, I'm a little nervous. I've never really liked waiting rooms.",
  "chatbotInstructions": "## Character\\nMargaret, a 58-year-old retired teacher. Guarded, warm beneath the surface, speaks in short sentences.\\n\\n## Character Instructions\\nGoal: get reassurance. Withhold the severity of symptoms until asked directly twice. Soften if the learner shows empathy.\\n\\n## Scenario Context\\nA clinic waiting room. Margaret has had a persistent cough for three weeks and is worried but reluctant to say so.\\n\\n## Learner Role\\nYou are a second-year medical student conducting an initial patient intake interview.\\n\\n## Voice Instructions\\nSpeak with nervous energy. Use incomplete sentences and self-corrections. Avoid medical terminology.",
  "maxMessages": 10,
  "avatarUrl": ""
}

chatbotInstructions structure for simulations — use ## markdown headers in this exact order:

## Character
[Specific name — never a generic label like "a patient". 2–4 personality traits, speaking style, relevant background.]

## Character Instructions
[Goals, strategy, what to reveal vs. withhold, how the character escalates or softens based on learner behavior.]

## Scenario Context
[Scene-setting: where, when, what happened immediately before the conversation starts.]

## Learner Role
[Who the learner is playing and what they are expected to accomplish in this conversation.]

## Voice Instructions
[Concrete, specific tone/delivery — e.g. "speaks in short sentences and self-corrects", "warm but businesslike". Never vague like "sound realistic".]

## Response Guidance (optional)
[Conditional rules for predictable branches: "If the learner asks about X, respond with Y. Do not reveal Z unless asked directly."]

## End Conversation (optional)
[Trigger condition; when met the character wraps up naturally and appends [END SIMULATION] on a new line.]

Field notes:
- initialMessage: 1–4 sentences. For simulations, written in character (not as narrator). For simple chatbots, a friendly prompt inviting the first question.
- maxMessages: Default 10. Increase only if the scenario clearly requires more turns.
- isRequired: Always false.

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

Instruction ordering — always follow this sequence:
1. Role / persona ("You are an expert writing coach...")
2. Task statement ("Review the following essay and provide feedback...")
3. Context, criteria, or learning goals
4. Conditional context (instructions with conditionalLogic on optional fields)
5. User content — always last ("Here is the learner's work:\\n\\n{field_name}")

### fixedResponse — Static (non-AI) text display
{
  "id": "fixedResponse-1700000000013",
  "name": "fixedResponse1",
  "type": "fixedResponse",
  "label": "",
  "isRequired": false,
  "text": "Welcome, {student_name}! Let's begin your session."
}

### scoring — AI-scored assessment / gate

The rubric field is a JSON array serialized as a single escaped string (JSON.stringify format — all inner
quotes escaped with backslash). Each criterion object has "criteria" (name) and "lines" (scored levels,
listed highest-to-lowest, always include score 0).

Rubric array structure (before serialization):
[
  {
    "criteria": "Criterion Name",
    "lines": [
      { "score": 5, "description": "Objective description of what earns full marks." },
      { "score": 3, "description": "Objective description of partial credit." },
      { "score": 0, "description": "Objective description of no credit." }
    ]
  }
]

Criteria must be objective and AI-scorable:
- Good: "Contains at least two specific examples", "Claim is stated in the opening paragraph"
- Bad: "Is the writing engaging?", "Quality of reasoning" — rewrite as observable, measurable behaviors

Full element example (rubric as serialized escaped string):
{
  "id": "scoring-1700000000014",
  "name": "scoring1",
  "type": "scoring",
  "label": "",
  "isRequired": true,
  "rubric": "[{\\"criteria\\":\\"Claim\\",\\"lines\\":[{\\"score\\":3,\\"description\\":\\"A clear, specific claim is stated in the opening paragraph.\\"},{\\"score\\":1,\\"description\\":\\"A claim is present but vague or buried later in the response.\\"},{\\"score\\":0,\\"description\\":\\"No identifiable claim.\\"}]},{\\"criteria\\":\\"Evidence\\",\\"lines\\":[{\\"score\\":3,\\"description\\":\\"At least two specific pieces of evidence are cited with source or context.\\"},{\\"score\\":1,\\"description\\":\\"Only one example, or examples lack specificity.\\"},{\\"score\\":0,\\"description\\":\\"No evidence provided.\\"}]}]",
  "minScore": 4,
  "scoreFeedbackEnabled": false,
  "scoreFeedbackInstructions": ""
}

Scoring element rules:
- isRequired: Always true — scoring gates block progression
- minScore: ~70–80% of max points for standard pass; 90%+ for mastery gates
- scoreFeedbackEnabled: true if the learner should see an explanation of their score
- Place immediately after the input element(s) being scored
- Split into multiple scoring elements if: criteria span >2 thematic domains, OR total points >15

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
6. scoring isRequired is always true; scoring gates block progression.
7. scoring rubric is a JSON array serialized as an escaped string; each criterion has "criteria" and "lines" (descending scores, always include 0).
8. chat chatbotInstructions uses ## markdown headers: Character, Character Instructions, Scenario Context, Learner Role, Voice Instructions (plus optional Response Guidance and End Conversation)."""

BUILD_SYSTEM_PROMPT = """You are an expert microapp builder AI. Your job is to create or modify microapp JSON based on user instructions.

=== MICROAPP JSON SCHEMA ===
{schema}
=== END SCHEMA ===

=== CURRENT APP JSON ===
{current_app_json}
=== END CURRENT APP JSON ===

=== APP DESIGN GUIDANCE ===

## Understanding the App Goals

Apps are rarely a single "type" — they commonly combine capabilities (e.g., an assessment that ends with a simulation, an accelerator with conditional branching, a multi-step sequence that mixes scoring and chat). Do not try to categorize the app into one type. Instead:

1. **Understand what the app needs to accomplish** — Read the brief and identify every distinct goal: What does the learner produce? What gets evaluated? What feedback do they receive? Is there a practice component? Does it generate reusable output?
2. **Identify which element capabilities are required** — Map each goal to the element type(s) that deliver it (see below).
3. **Design the element sequence** — Arrange elements in the order that serves the learner's journey.

### Element Capabilities — Match Goals to Elements

**Collect structured input** → text, textarea, radio, checkbox, dropdown, slider, boolean, imageUpload
Use these when the learner needs to provide information, make a choice, or upload content.

**Display instructions, context, or a passage** → richText (static HTML), title (section heading), fixedResponse (static text with variable injection)
Use richText or title to orient the learner before an action. Use fixedResponse to echo back user values in a confirmation or summary.

**Generate AI output** → aiResponse
Use for any AI-generated content: feedback, summaries, generated resources, personalized responses, or debriefs. The instructions array is the prompt — build it thoughtfully (see aiResponse Prompt Construction below).

**Assess and gate on quality** → scoring
Use when the app needs to evaluate a learner's input against criteria, assign a score, and optionally block progression until a minimum threshold is met.

**Enable free-form conversation** → chat (Mode A: simple chatbot)
Use when the learner needs a free-form assistant: Q&A against a document, a study helper, a support bot, or any scenario where the AI answers questions rather than plays a role. chatbotInstructions is a plain system prompt.

**Practice through dialogue** → chat (Mode B: character simulation)
Use when the learner practices an interpersonal skill through open-ended dialogue with a character (clinical intake, sales pitch, job interview, negotiation, difficult conversation). Requires a fully designed character in chatbotInstructions.

**Repeat a task with different inputs** → aiResponse with 1–5 input elements (accelerator pattern)
Use when the goal is a repeatable, prompt-wrapper tool that takes structured inputs and produces consistent output. Every input must earn its place.

**Adapt based on earlier answers** → conditionalLogic on any element or aiResponse instruction
Use to show/hide elements or include/exclude prompt snippets based on a learner's earlier responses.

---

## Element Sequencing Rules

- When scoring and feedback elements are both present, they go in the order of feedback first, then scoring.
- chat elements go where the conversation belongs in the learner flow
- conditionalLogic.sourceFieldId must reference an element that appears BEFORE the current one
- Place title elements before each major section to orient the learner
- When building an accelerator-style output, aiResponse is the final element

---

## Scoring Gate Design

Use a scoring element for any assessment, evaluation, or pass/fail logic.

Rubric criteria must be objective and AI-scorable:
- Good: "Contains at least two specific examples", "Claim is stated in the opening paragraph"
- Bad: "Is the writing engaging?", "Quality of reasoning" — rewrite as observable, measurable behaviors

Split into multiple scoring elements if:
- Criteria span more than 2 distinct thematic domains
- Total possible points exceed 15
- Any single criterion would itself require a rubric to evaluate

Set minScore to ~70–80% of max points for a standard pass. Use 90%+ for mastery gates.
Set scoreFeedbackEnabled to true if the learner should see an explanation of their score inline.

---

## Chat Element Design

The chat element has two modes — choose the right one based on the use case.

**Mode A: Simple / informational chatbot** — Use when the learner needs a free-form assistant: Q&A against a document, a study helper, a support bot, or any scenario where the AI answers questions rather than plays a role. chatbotInstructions is a plain system prompt (no ## headers needed). Example: "You are a helpful study assistant. Answer questions about the assigned reading clearly and concisely. If a question is outside the scope of the material, say so."

**Mode B: Character simulation** — Use when the learner practices a real-world interpersonal skill through dialogue (interviewing a patient, pitching to an investor, navigating a difficult conversation). The AI plays a specific character. chatbotInstructions uses ## markdown headers.

For simulation chatbotInstructions, use ## headers in this order: Character, Character Instructions, Scenario Context, Learner Role, Voice Instructions, and optionally Response Guidance and End Conversation.

Key simulation design rules:
- Give the character a specific name (not a generic label like "a patient" — use "Margaret, a 58-year-old retired teacher")
- Character Instructions must include: goals, strategy, what to reveal vs. withhold, and how the character escalates or softens based on learner behavior
- Voice Instructions must be specific and concrete ("speaks in short sentences and self-corrects") — never vague ("sound realistic")
- initialMessage: written in character, not as narrator; 1–4 sentences; establishes personality and gives the learner a clear cue
- Default maxMessages is 10; increase only if the scenario clearly requires more turns
- If the simulation has a natural conclusion, use an End Conversation section: the character wraps up and appends [END SIMULATION] on a new line when the trigger condition is met

---

## Feedback (aiResponse) Design

For qualitative, formative feedback — never a score or grade. Build aiResponse instructions in this order:

1. Persona — "You are an experienced instructional coach providing constructive feedback to a learner."
2. Task — "Review the learner's work below and provide constructive, formative feedback. Do not assign a score or grade."
3. Learning goals — List 2–4 goals explicitly; these become the organizing sections of the feedback
4. Structure — "Start with a brief overall impression (2–3 sentences), then address each learning goal: one strength, one development area, one concrete suggestion. End with one actionable priority for next time."
5. Format — "Format in markdown. Use bold text for key points, bullet points within each section, and emoji: ✅ strengths, 🔧 development areas, 💡 suggestions, 🎯 priority action. No lengthy paragraphs. No scores."
6. Conciseness — "3–5 bullets per section maximum. No filler opening lines like 'Great job!'. Go directly to the feedback."
7. User content — Always last; inject each relevant field with a clear label: "Here is the learner's work:\\n\\n{{field_name}}"

When paired with a scoring gate, align the feedback's learning goals to the rubric's criterion dimensions — reframe them as growth-oriented goals, not scores.

---

## Accelerator-Style Prompt Engineering

When the app's goal is a repeatable prompt-wrapper tool (generating content, mapping objectives, building a rubric, etc.), build the aiResponse instructions in this order:

1. Role + task — specific persona and exactly what to produce: "You are an expert instructional designer. Your task is to generate {{num_questions}} multiple choice questions about {{topic}} suitable for {{level}} learners."
2. Rules and constraints — directive, not suggestive: "Each question must have exactly 4 options. Only one option is correct. Distractors must be plausible, not obviously wrong."
3. Conditional snippets — for each boolean toggle, add an instruction with conditionalLogic (operator: equals, value: true) that fires only when the toggle is on
4. Output format — specify markdown structure, headers, bullet points, emoji color symbols explicitly
5. Output example — always include a concrete example: "Here is an example of the output format to follow exactly: ..." — the AI treats this as a formatting contract
6. User content — always last; inject user inputs with clear labels

Always include in accelerator prompts: "Do not add preamble or summary. Go directly to the output."
Use emoji color symbols for scannability where appropriate (✅ 🔴 🟡 🟢 📝 ⚠️).

---

## General aiResponse Prompt Construction

For all aiResponse elements, always order instructions:
1. Role / persona
2. Task statement
3. Context, criteria, or learning goals
4. Conditional context (instructions with conditionalLogic on optional fields)
5. User content — always last

=== END DESIGN GUIDANCE ===

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

            yield _sse_status_event("classifying", "Reviewing your request...")

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

            yield _sse_status_event("planning", "Planning your app...")

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
                    elif event_type == "status":
                        yield f"event: status\ndata: {chunk}\n\n"
            except Exception as e:
                log.error(f"App builder build stage error: {e}")
                yield f"event: error\ndata: {json.dumps({'message': 'An error occurred while generating the app. Please try again.'})}\n\n"
                return

            yield _sse_status_event("validating", "Applying changes...")

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
            "max_tokens": 1000,
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

        Yields:
        - ("thinking", str) — extended thinking tokens
        - ("text", str) — assistant text (PLAN / SUMMARY) outside the JSON fence
        - ("status", str) — full JSON string for SSE: {"stage": ..., "message": ...}

        JSON content inside ```json...``` fences is silently appended to json_accumulator
        instead of being yielded, so it never reaches the frontend as raw JSON.

        Nested markdown fences inside JSON strings (e.g. ```python) must not be treated
        as the end of the outer ```json block; extraction uses matching `{`/`}` outside
        of JSON strings, then consumes the real closing ``` line.
        """

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
        json_body_captured = False
        json_heartbeat_n = 0
        _building_status = json.dumps(
            {"stage": "building", "message": "Building app structure..."}
        )

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

            choice = chunk.get("choices", [{}])[0]
            delta = choice.get("delta") or {}

            thinking = delta.get("thinking", "")
            if thinking:
                yield ("thinking", thinking)

            raw = _streaming_assistant_text_chunk(chunk)
            if not raw:
                continue

            if in_json:
                json_heartbeat_n += 1
                if json_heartbeat_n > 1 and json_heartbeat_n % 50 == 0:
                    yield ("status", _building_status)

            # Feed into the lookahead buffer and process
            text_buf += raw
            while True:
                if not in_json:
                    m_open = _OPEN_JSON_FENCE_START.search(text_buf)
                    if not m_open:
                        # No opening fence yet; emit everything except a possible
                        # partial ```json / ``` json match at the end of the buffer.
                        safe_len = max(
                            0, len(text_buf) - _OPEN_JSON_FENCE_LOOKBACK
                        )
                        if safe_len > 0:
                            yield ("text", text_buf[:safe_len])
                            text_buf = text_buf[safe_len:]
                        break
                    else:
                        idx = m_open.start()
                        # Emit text before the fence, then enter JSON mode.
                        if idx > 0:
                            yield ("text", text_buf[:idx])
                        text_buf = text_buf[m_open.end() :]
                        # Skip a single optional newline after ```json
                        if text_buf.startswith("\n"):
                            text_buf = text_buf[1:]
                        in_json = True
                        json_body_captured = False
                        json_heartbeat_n = 0
                        yield ("status", _building_status)
                else:
                    if text_buf.lstrip().startswith("{"):
                        span = _find_root_json_span(text_buf)
                        if span is None:
                            break
                        start, end = span
                        json_accumulator.append(text_buf[start:end])
                        text_buf = text_buf[end:]
                        json_body_captured = True
                    elif not json_body_captured:
                        # Waiting for more streamed bytes before the root `{` appears.
                        break

                    n = _consume_outer_json_markdown_close_fence(text_buf)
                    if n is None:
                        break
                    if n > 0:
                        text_buf = text_buf[n:]
                    in_json = False
                    json_heartbeat_n = 0
                    continue

        # Flush whatever remains in the buffer after the stream ends.
        if text_buf.strip() and not in_json:
            yield ("text", text_buf.strip())
        elif text_buf and in_json:
            # Stream ended inside the ```json region: keep only a complete root object.
            if json_body_captured:
                n = _consume_outer_json_markdown_close_fence(text_buf)
                if n is not None and n > 0:
                    text_buf = text_buf[n:]
                if text_buf.strip():
                    yield ("text", text_buf.strip())
            else:
                span = _find_root_json_span(text_buf)
                if span:
                    start, end = span
                    json_accumulator.append(text_buf[start:end])
                elif text_buf.strip():
                    json_accumulator.append(text_buf)

    def _extract_and_validate_json(self, raw: str) -> dict:
        """Strip markdown fences if present, parse JSON, and verify basic structure."""
        text = raw.strip()
        if not text:
            raise ValueError(
                "The AI did not return any app JSON to parse (empty response). "
                "Please try again."
            )

        # Prefer brace-balanced extraction so nested ``` inside JSON strings does not
        # truncate the payload (same issue as streaming fence detection).
        json_open = re.search(r"```\s*json(?![a-zA-Z])", text, re.IGNORECASE)
        if json_open:
            tail = text[json_open.end() :]
            span = _find_root_json_span(tail)
            if span:
                start, end = span
                text = tail[start:end]
            else:
                text = tail
        else:
            fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
            if fence_match:
                text = fence_match.group(1).strip()

        text = text.strip()
        if not text:
            raise ValueError(
                "The AI did not return parseable app JSON (empty after extracting "
                "the JSON block). Please try again."
            )

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
