/**
 * Chat answers are stored as strings:
 *   user: <message>
 *   ai: <message>|<run_id>
 *
 * Markdown tables use `|` as column separators, so parsers must only treat
 * the final `|` as a run-id delimiter when the suffix looks like a run id.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK_RUN_ID_RE = /^\d+-[a-z0-9]+$/i;

export interface ParsedChatMessage {
  sender: "user" | "ai";
  message: string;
  run_id?: string;
}

function isRunIdSuffix(value: string): boolean {
  const suffix = value.trim();
  return (
    suffix === "" || UUID_RE.test(suffix) || FALLBACK_RUN_ID_RE.test(suffix)
  );
}

export function parseChatHistoryEntry(raw: string): ParsedChatMessage {
  const [senderRaw, ...rest] = raw.split(": ");
  const sender: "user" | "ai" = senderRaw === "ai" ? "ai" : "user";
  const fullText = rest.join(": ");

  if (sender !== "ai") {
    return { sender, message: fullText };
  }

  const lastPipe = fullText.lastIndexOf("|");
  if (lastPipe === -1) {
    return { sender, message: fullText };
  }

  const suffix = fullText.slice(lastPipe + 1);
  if (isRunIdSuffix(suffix)) {
    return {
      sender,
      message: fullText.slice(0, lastPipe),
      run_id: suffix.trim() || undefined,
    };
  }

  return { sender, message: fullText };
}

export function serializeChatHistoryEntry(msg: {
  sender: string;
  message: string;
  run_id?: string;
}): string {
  if (msg.sender === "ai") {
    return `${msg.sender}: ${msg.message}|${msg.run_id || ""}`;
  }
  return `${msg.sender}: ${msg.message}`;
}
