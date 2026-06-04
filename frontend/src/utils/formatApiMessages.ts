import type { ApiMessage } from "@/store/conversationStore";

export type FormattedApiMessageBlock = {
  role: string;
  label: string;
  text: string;
  hasImages: boolean;
  imageCount: number;
};

const ROLE_LABELS: Record<string, string> = {
  system: "System",
  user: "User",
  assistant: "Assistant",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

function isImagePart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false;
  const p = part as Record<string, unknown>;
  return p.type === "image_url" || p.type === "image";
}

export function formatMessageContent(content: unknown): {
  text: string;
  imageCount: number;
} {
  if (content == null) return { text: "", imageCount: 0 };
  if (typeof content === "string") {
    return { text: content, imageCount: 0 };
  }
  if (Array.isArray(content)) {
    const textParts: string[] = [];
    let imageCount = 0;
    for (const part of content) {
      if (isImagePart(part)) {
        imageCount += 1;
        continue;
      }
      if (part && typeof part === "object") {
        const p = part as Record<string, unknown>;
        if (p.type === "text" && typeof p.text === "string") {
          textParts.push(p.text);
        } else if (typeof p.content === "string") {
          textParts.push(p.content);
        }
      } else if (typeof part === "string") {
        textParts.push(part);
      }
    }
    const text = textParts.join("\n\n").trim();
    const imageNote =
      imageCount > 0
        ? `[${imageCount} image attachment${imageCount === 1 ? "" : "s"}]`
        : "";
    return {
      text: [text, imageNote].filter(Boolean).join("\n\n"),
      imageCount,
    };
  }
  if (typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return { text: o.text, imageCount: 0 };
    if (typeof o.content === "string") return { text: o.content, imageCount: 0 };
    try {
      return { text: JSON.stringify(content, null, 2), imageCount: 0 };
    } catch {
      return { text: String(content), imageCount: 0 };
    }
  }
  return { text: String(content), imageCount: 0 };
}

export function summarizeApiMessages(
  messages: ApiMessage[] | undefined
): FormattedApiMessageBlock[] {
  if (!messages?.length) return [];
  return messages.map((msg) => {
    const { text, imageCount } = formatMessageContent(msg.content);
    return {
      role: msg.role,
      label: roleLabel(msg.role),
      text: text || (imageCount > 0 ? "" : "(empty)"),
      hasImages: imageCount > 0,
      imageCount,
    };
  });
}
