# Microapp JSON Schema Reference

This document gives an AI everything it needs to generate syntactically correct `app_json` for creating microapps. The backend stores `app_json` as a JSON field and is schema-agnostic — the frontend owns this contract.

---

## Top-Level Shape (V2 — Preferred)

New apps should use the **V2 format**, which has a flat `elements[]` array instead of nested `phases[]`.

```json
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
```

### Top-Level Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | Yes | Shown on dashboard and top of app |
| `description` | string | No | Shown below title on run screen |
| `privacySettings` | `"public"` \| `"private"` \| `"restricted"` | No | Default: `"private"` |
| `clonable` | boolean | No | Whether other users can clone this app |
| `completedHtml` | string | No | Message shown when app is complete |
| `aiConfig` | AIConfig object | No | App-wide AI settings |
| `attachedFiles` | AttachedFile[] | No | Files attached to the app for AI context |
| `elements` | Element[] | Yes | Ordered list of all elements (see below) |

### AIConfig Object

```json
{
  "aiModel": "gpt-4o-mini",
  "temperature": 0.7,
  "maxResponseTokens": null,
  "systemPrompt": ""
}
```

| Field | Type | Notes |
|-------|------|-------|
| `aiModel` | string | The LiteLLM model identifier (e.g., `"gpt-4o-mini"`, `"claude-3-5-sonnet"`) |
| `temperature` | number (0–1) | Controls randomness. 0 = deterministic, 1 = most random |
| `maxResponseTokens` | number \| null | Max tokens in AI response; `null` for no limit |
| `systemPrompt` | string | App-wide system prompt injected before all AI calls |

---

## Elements Array

The `elements` array is the heart of a V2 app. Elements are rendered top-to-bottom in the order they appear. There are two categories:

- **Input elements** — collect data from the user
- **Output/structural elements** — display content or trigger AI

### Element ID Convention

IDs follow the pattern `{type}-{timestamp}` where timestamp is a Unix millisecond integer. When generating, use any unique string that follows this pattern, e.g. `"text-1700000000001"`.

### All Element Types

```
Input:      text | textarea | radio | checkbox | dropdown | slider | boolean | richText | chat | imageUpload
Structural: title | aiResponse | fixedResponse | scoring
```

---

## Input Element Types

All input elements share these **core fields**:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | Yes | Unique ID, e.g. `"text-1700000000001"` |
| `name` | string | Yes | Variable name used in prompts via `{name}` interpolation |
| `type` | ElementType | Yes | See type list above |
| `label` | string | Yes | The question/label shown to the user |
| `isRequired` | boolean | Yes | Whether the user must fill this field |
| `description` | string | No | Helper text shown below the label |
| `placeholder` | string | No | Placeholder text inside the input |
| `defaultValue` | string \| string[] \| number \| boolean | No | Pre-filled value |
| `readOnly` | boolean | No | Prevents user editing |
| `conditionalLogic` | ConditionalLogic | No | Show/hide this element based on another field's value |

---

### `text` — Single-line text input

```json
{
  "id": "text-1700000000001",
  "name": "student_name",
  "type": "text",
  "label": "What is your name?",
  "isRequired": true,
  "placeholder": "Enter your name..."
}
```

Additional fields: `minChars`, `maxChars`

---

### `textarea` — Multi-line text input

```json
{
  "id": "textarea-1700000000002",
  "name": "essay_text",
  "type": "textarea",
  "label": "Paste your essay here:",
  "isRequired": true,
  "placeholder": "Enter text..."
}
```

Additional fields: `minChars`, `maxChars`

---

### `radio` — Single-choice selection

```json
{
  "id": "radio-1700000000003",
  "name": "difficulty",
  "type": "radio",
  "label": "Select difficulty level:",
  "isRequired": false,
  "defaultValue": "Item 1",
  "choices": [
    { "text": "Easy", "value": "Item 1" },
    { "text": "Medium", "value": "Item 2" },
    { "text": "Hard", "value": "Item 3" }
  ],
  "showOtherItem": false
}
```

Additional fields: `showOtherItem`, `otherText`, `otherPlaceholder`, `otherErrorText`, `showNoneItem`, `noneText`

**Note on `choices`:** `value` is typically `"Item 1"`, `"Item 2"`, etc. The `text` is the human-readable label. When referencing the choice in `conditionalLogic`, use the `value` (e.g., `"Item 1"`).

---

### `checkbox` — Multi-choice selection

```json
{
  "id": "checkbox-1700000000004",
  "name": "topics",
  "type": "checkbox",
  "label": "Which topics should be covered?",
  "isRequired": false,
  "choices": [
    { "text": "Grammar", "value": "Item 1" },
    { "text": "Vocabulary", "value": "Item 2" },
    { "text": "Reading", "value": "Item 3" }
  ],
  "showOtherItem": true
}
```

Additional fields: same as `radio`. When used in a prompt via `{name}`, the selected values are joined as a comma-separated list.

---

### `dropdown` — Single-choice dropdown

Same structure as `radio`, but renders as a `<select>` dropdown.

```json
{
  "id": "dropdown-1700000000005",
  "name": "grade_level",
  "type": "dropdown",
  "label": "Grade level:",
  "isRequired": false,
  "choices": [
    { "text": "Grade 1", "value": "Item 1" },
    { "text": "Grade 2", "value": "Item 2" }
  ]
}
```

---

### `slider` — Numeric slider

```json
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
```

Additional fields: `minValue` (default: 0), `maxValue`, `step`

---

### `boolean` — True/false toggle

```json
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
```

Additional fields: `labelTrue`, `labelFalse`, `swapOrder`

**Note:** When used in `conditionalLogic`, use `true` or `false` (boolean, not string) as the `value`.

---

### `richText` — Static HTML display (read-only)

Used for formatted instructions or content that requires HTML. Not an input field.

```json
{
  "id": "richText-1700000000008",
  "name": "instructions_block",
  "type": "richText",
  "label": "",
  "isRequired": false,
  "html": "<p>Please read the passage below carefully before answering.</p>"
}
```

---

### `imageUpload` — Image upload input

```json
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
```

Additional fields: `multiple`, `maxFiles`, `maxFileSize` (in MB), `allowedFileTypes`

---

### `chat` — Chatbot interface

Renders a full chat widget where the user has a back-and-forth conversation with the AI.

```json
{
  "id": "chat-1700000000010",
  "name": "chat_session",
  "type": "chat",
  "label": "Chat with the AI tutor:",
  "isRequired": false,
  "initialMessage": "Hello! What would you like to learn today?",
  "chatbotInstructions": "You are a friendly tutor. Help the user understand the topic they ask about.",
  "maxMessages": 10,
  "avatarUrl": ""
}
```

Additional fields: `maxMessages`, `initialMessage`, `chatbotInstructions`, `avatarUrl`, `enableTts`, `ttsProvider`, `selectedVoiceId`

---

## Structural / Output Element Types

These elements don't collect user input — they display information or trigger AI responses.

---

### `title` — Section heading / divider

Use this to add visual section headers between groups of elements.

```json
{
  "id": "title-1700000000011",
  "name": "section1_title",
  "type": "title",
  "label": "Step 1: Provide Your Content",
  "isRequired": false,
  "description": "Fill in the fields below to get started."
}
```

---

### `aiResponse` — AI-generated response

This is the most important structural element. It triggers an AI call and displays the response. The `instructions[]` array defines what gets sent to the AI — each instruction is a text prompt piece that may have conditional logic.

**User-provided values are injected using `{field_name}` placeholders**, where `field_name` matches the `name` property of an input element that appears above this `aiResponse` element.

```json
{
  "id": "aiResponse-1700000000012",
  "name": "aiResponse1",
  "type": "aiResponse",
  "label": "",
  "isRequired": false,
  "instructions": [
    {
      "text": "You are an expert writing coach. Please review the following essay and provide constructive feedback."
    },
    {
      "text": "The student's grade level is {grade_level}. Please calibrate your feedback accordingly.",
      "conditionalLogic": {
        "sourceFieldId": "dropdown-1700000000005",
        "operator": "is_not_empty"
      }
    },
    {
      "text": "Here is the essay:\n\n{essay_text}"
    }
  ]
}
```

**`instructions[]` item fields:**

| Field | Type | Notes |
|-------|------|-------|
| `text` | string | The prompt text. Use `{field_name}` to inject user values |
| `conditionalLogic` | ConditionalLogic | Optional. Only include this instruction if condition is met |

All `instructions` that pass their conditional logic are **concatenated** into a single prompt sent to the AI.

---

### `fixedResponse` — Static (non-AI) text display

Displays a static message (supports Markdown). Useful for personalized greetings or instructions that include user-provided values but don't require AI.

```json
{
  "id": "fixedResponse-1700000000013",
  "name": "fixedResponse1",
  "type": "fixedResponse",
  "label": "",
  "isRequired": false,
  "text": "Welcome, {student_name}! Let's begin your session."
}
```

---

### `scoring` — AI-scored assessment

Sends the user's inputs to the AI for scoring against a rubric. Users cannot proceed past a required scoring element unless they meet the minimum score.

```json
{
  "id": "scoring-1700000000014",
  "name": "scoring1",
  "type": "scoring",
  "label": "",
  "isRequired": true,
  "rubric": "Clarity\n2 points – The argument is clearly stated and easy to follow.\n0 points – The argument is unclear or difficult to follow.\n\nEvidence\n3 points – At least two specific pieces of evidence are cited.\n0 points – No specific evidence is cited.",
  "minScore": 4,
  "scoreFeedbackEnabled": false,
  "scoreFeedbackInstructions": ""
}
```

| Field | Type | Notes |
|-------|------|-------|
| `rubric` | string | Plain-text rubric. Each criterion on its own line with point values |
| `minScore` | number | Total points user must achieve to pass |
| `isRequired` | boolean | If `true`, user must pass to continue. If `false`, scoring is informational only |
| `scoreFeedbackEnabled` | boolean | Whether to show AI feedback alongside the score |
| `scoreFeedbackInstructions` | string | Additional instructions for the AI feedback |

---

## Conditional Logic

Any input element, `aiResponse` instruction, or `fixedResponse` can have `conditionalLogic` to show/hide itself based on the value of another element.

```json
"conditionalLogic": {
  "sourceFieldId": "radio-1700000000003",
  "operator": "equals",
  "value": "Item 2"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `sourceFieldId` | string | The `id` of the field to evaluate |
| `operator` | string | See table below |
| `value` | string \| number \| boolean | The value to compare against. Not required for `is_empty` / `is_not_empty` |

### Available Operators by Field Type

| Operator | Works on |
|----------|----------|
| `equals` | text, textarea, radio, dropdown, boolean, slider |
| `not_equals` | text, textarea, radio, dropdown, boolean, slider |
| `contains` | text, textarea, radio, checkbox, dropdown |
| `not_contains` | text, textarea, radio, checkbox, dropdown |
| `is_empty` | text, textarea, radio, checkbox, dropdown |
| `is_not_empty` | text, textarea, radio, checkbox, dropdown |
| `greater_than` | slider |
| `less_than` | slider |
| `greater_than_or_equal` | slider |
| `less_than_or_equal` | slider |

**Important notes:**
- `sourceFieldId` must be the `id` of an element that appears **before** the current element
- For `boolean` fields, `value` must be `true` or `false` (boolean, not a string)
- For `radio`/`dropdown` fields, `value` must match the choice's `value` field (e.g., `"Item 2"`), not its `text`
- `is_empty` and `is_not_empty` do not require a `value` field

---

## Value Interpolation in Prompts

Inside any `text` field of an `aiResponse` instruction or a `fixedResponse`, you can reference the user's input using curly-brace placeholders:

```
{field_name}
```

Where `field_name` is the `name` property of any input element.

**Examples:**
- `"Please write {num_questions} questions about {topic}."` — references `slider` named `num_questions` and `text` named `topic`
- `"Welcome, {student_name}!"` — references a `text` input named `student_name`
- `"Difficulty level selected: {difficulty}"` — references a `radio` named `difficulty`

For `checkbox` fields with multiple selections, the selected values are joined as a comma-separated list.

---

## Full Example: Multiple Choice Question Generator (V2 Format)

This demonstrates a complete app with diverse field types, conditional logic, and an `aiResponse` with multiple instructions.

```json
{
  "title": "Multiple Choice Generator",
  "description": "Generate multiple choice questions from any content.",
  "privacySettings": "private",
  "clonable": true,
  "completedHtml": "Your questions have been generated!",
  "aiConfig": {
    "aiModel": "gpt-4o-mini",
    "temperature": 0.7,
    "maxResponseTokens": null,
    "systemPrompt": ""
  },
  "attachedFiles": [],
  "elements": [
    {
      "id": "title-1700000000001",
      "name": "title1",
      "type": "title",
      "label": "Configure Your Questions",
      "isRequired": false,
      "description": "Fill in the details below to generate your questions."
    },
    {
      "id": "textarea-1700000000002",
      "name": "source_content",
      "type": "textarea",
      "label": "Paste the content to generate questions from:",
      "isRequired": true,
      "placeholder": "Enter your text here..."
    },
    {
      "id": "slider-1700000000003",
      "name": "num_questions",
      "type": "slider",
      "label": "Number of questions:",
      "isRequired": false,
      "minValue": 1,
      "maxValue": 10,
      "defaultValue": 3
    },
    {
      "id": "radio-1700000000004",
      "name": "difficulty",
      "type": "radio",
      "label": "Question difficulty:",
      "isRequired": false,
      "defaultValue": "Item 1",
      "choices": [
        { "text": "Easy", "value": "Item 1" },
        { "text": "Medium", "value": "Item 2" },
        { "text": "Hard", "value": "Item 3" }
      ]
    },
    {
      "id": "boolean-1700000000005",
      "name": "include_answer_key",
      "type": "boolean",
      "label": "Include an answer key?",
      "isRequired": false,
      "defaultValue": true
    },
    {
      "id": "textarea-1700000000006",
      "name": "learning_objective",
      "type": "textarea",
      "label": "Learning objective (optional):",
      "isRequired": false,
      "placeholder": "e.g. Students should be able to explain the water cycle."
    },
    {
      "id": "aiResponse-1700000000007",
      "name": "aiResponse1",
      "type": "aiResponse",
      "label": "",
      "isRequired": false,
      "instructions": [
        {
          "text": "You are an expert educator. Generate {num_questions} multiple choice questions based on the content I provide."
        },
        {
          "text": "Make the questions {difficulty} difficulty.",
          "conditionalLogic": {
            "sourceFieldId": "radio-1700000000004",
            "operator": "is_not_empty"
          }
        },
        {
          "text": "Align the questions to the following learning objective: {learning_objective}",
          "conditionalLogic": {
            "sourceFieldId": "textarea-1700000000006",
            "operator": "is_not_empty"
          }
        },
        {
          "text": "Include an answer key at the end.",
          "conditionalLogic": {
            "sourceFieldId": "boolean-1700000000005",
            "operator": "equals",
            "value": true
          }
        },
        {
          "text": "Here is the source content:\n\n{source_content}"
        }
      ]
    }
  ]
}
```

---

## Legacy Format (Phase-Based) — For Reference Only

Older apps use a `phases[]` array instead of `elements[]`. The frontend automatically migrates legacy apps to V2 at runtime. **Do not generate new apps in the legacy format.**

In the legacy format:
- Each `phase` has `elements[]` (input fields) and `prompts[]` (AI/fixed response triggers)
- Prompt types are `"prompt"`, `"aiInstructions"`, and `"fixedResponse"`
- Phase-level scoring is configured with `scoredPhase`, `rubric`, and `minScore` on the phase object

---

## Rules Summary

1. Always use the **V2 format** (`elements[]` at the top level, no `phases[]`).
2. Element `id` values must be **unique** within the app; use the `{type}-{timestamp}` convention.
3. Element `name` values must be **unique** and contain only **alphanumeric characters and underscores** — no spaces. They are used as variable names in `{placeholder}` interpolation.
4. `aiResponse` instructions are concatenated in order; put context-setting instructions first and the user content last.
5. `conditionalLogic.sourceFieldId` must reference the `id` of an element that appears **before** the current element in the array.
6. For `boolean` conditional values, use JSON `true`/`false`, not `"true"`/`"false"` strings.
7. For `radio`/`dropdown` choices, the `value` field (e.g., `"Item 1"`) is what gets injected into prompts and what conditional logic matches against — not the `text` field.
8. `scoring` elements require a `rubric` string that describes each criterion and its point values in plain text.
9. The `aiConfig` block is optional; if omitted, the platform default model and temperature are used.
