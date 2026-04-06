import { format } from "date-fns";

export type ConversationMessage = {
  timestamp: string;
  user_id?: number | null;
  /** Backend JSONField — string, object, or message list */
  system_prompt: unknown;
  phase_instructions: string;
  user_prompt: string;
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
