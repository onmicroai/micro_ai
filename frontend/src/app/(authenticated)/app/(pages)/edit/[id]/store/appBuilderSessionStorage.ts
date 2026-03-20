import type { AppJsonV2, ChatBuildMessage } from "@/app/(authenticated)/app/types";

export const APP_BUILDER_SESSION_VERSION = 1 as const;
export const APP_BUILDER_UNDO_STACK_MAX = 10;

export type PersistedAppBuilderState = {
  v: typeof APP_BUILDER_SESSION_VERSION;
  messages: ChatBuildMessage[];
  undoStack: AppJsonV2[];
};

function storageKey(appId: number) {
  return `microai:appBuilder:v${APP_BUILDER_SESSION_VERSION}:${appId}`;
}

export function readAppBuilderSession(
  appId: number
): PersistedAppBuilderState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(appId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAppBuilderState;
    if (parsed?.v !== APP_BUILDER_SESSION_VERSION) return null;
    if (!Array.isArray(parsed.messages) || !Array.isArray(parsed.undoStack)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeAppBuilderSession(
  appId: number,
  partial: Pick<PersistedAppBuilderState, "messages" | "undoStack">
): void {
  if (typeof window === "undefined") return;
  const payload: PersistedAppBuilderState = {
    v: APP_BUILDER_SESSION_VERSION,
    messages: partial.messages,
    undoStack: partial.undoStack.slice(-APP_BUILDER_UNDO_STACK_MAX),
  };
  sessionStorage.setItem(storageKey(appId), JSON.stringify(payload));
}
