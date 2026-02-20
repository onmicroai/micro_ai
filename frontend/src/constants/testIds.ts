/**
 * Centralized data-testid values for E2E tests and component markup.
 * Use these constants in both components and tests to keep selectors in sync.
 */
export const TEST_IDS = {
  CHAT_AUDIO_UPLOAD_INPUT: "chat-audio-upload-input",
  IMAGE_PREVIEW_CONTAINER: "image-preview-container",
  FLOW_CONTINUE_BUTTON: "flow-continue-button",
} as const;

export type TestId = (typeof TEST_IDS)[keyof typeof TEST_IDS];
