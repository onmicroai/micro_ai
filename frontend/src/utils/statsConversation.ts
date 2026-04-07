import { format } from "date-fns";

export type ConversationMessage = {
  timestamp: string;
  user_id?: number | null;
  /** Backend JSONField — string, object, or message list */
  system_prompt: unknown;
  /** Phase / chatbot instructions (JSONField) */
  phase_instructions: unknown;
  /** Survey phase title when the run was created */
  phase_title?: string;
  /** Explicit marker: run originated from chat component */
  is_chat_run?: boolean;
  /** Final user prompt / chat line (JSONField) */
  user_prompt: unknown;
  response: string;
  rubric: string;
  scored_run?: boolean;
  /** Raw stored score (JSON dict, number, or LLM prose + JSON) */
  run_score: unknown;
  /** Parsed total from backend when available */
  score_total?: number | null;
  run_passed: boolean | null;
  credits?: number | null;
  minimum_score?: number | null;
  score_feedback?: string;
};

/** Collapse long system prompts in the conversation details dialog */
export const SYSTEM_PROMPT_COLLAPSE_CHARS = 400;

/** Collapse long chat-instruction blocks (Figma: Chat Instructions + Show more) */
export const CHAT_INSTRUCTIONS_COLLAPSE_CHARS = 400;

export type ConversationPhaseGroup = {
  mergeKey: string;
  phaseTitle: string;
  messages: ConversationMessage[];
};

/** Stable key for grouping runs in the same phase / chat session */
export function phaseInstructionsKey(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Group only chat runs (`is_chat_run=true`) when they are consecutive and share
 * the same phase title + phase instructions. Non-chat runs stay one-per-group.
 */
export function groupConversationMessagesByPhase(
  rows: ConversationMessage[]
): ConversationPhaseGroup[] {
  const groups: ConversationPhaseGroup[] = [];
  rows.forEach((row, idx) => {
    if (!row.is_chat_run) {
      groups.push({
        mergeKey: `single:${idx}`,
        phaseTitle: (row.phase_title ?? "").trim(),
        messages: [row],
      });
      return;
    }

    const title = (row.phase_title ?? "").trim();
    const ik = phaseInstructionsKey(row.phase_instructions);
    const mergeKey = `${title}\0${ik}`;
    const last = groups[groups.length - 1];
    if (last && last.mergeKey === mergeKey) {
      last.messages.push(row);
    } else {
      groups.push({
        mergeKey,
        phaseTitle: (row.phase_title ?? "").trim(),
        messages: [row],
      });
    }
  });
  return groups;
}

/** Turn Run.system_prompt JSON into readable text for exports and dialog */
export function formatStoredPrompt(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object" && item !== null && "content" in item) {
          const c = (item as { content?: unknown }).content;
          return typeof c === "string" ? c.trim() : "";
        }
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("\n\n");
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.content === "string" && o.content.trim())
      return o.content.trim();
    if (typeof o.text === "string" && o.text.trim()) return o.text.trim();
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }
  return "";
}

export function formatConversationTimestamp(timestamp: string): string {
  return format(new Date(timestamp), "MMM d, yyyy HH:mm:ss");
}

export function formatConversationHeaderTimestamp(timestamp: string): string {
  return format(new Date(timestamp), "dd.MM.yyyy, HH:mm:ss");
}

/** First non-empty formatted system prompt in the session */
export function getSessionSystemPromptText(
  messages: ConversationMessage[] | undefined
): string {
  if (!messages?.length) return "";
  for (const m of messages) {
    const t = formatStoredPrompt(m.system_prompt);
    if (t) return t;
  }
  return "";
}
