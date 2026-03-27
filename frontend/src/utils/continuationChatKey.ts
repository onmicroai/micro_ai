export function getContinuationChatKey(
  appId: number | null,
  userId: number | null | undefined,
): string {
  return `continuation_chat_${appId}_${userId}`;
}
