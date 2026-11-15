/**
 * Centralized data-testid values for E2E tests and component markup.
 * Use these constants in both components and tests to keep selectors in sync.
 */
export const TEST_IDS = {
  CHAT_AUDIO_UPLOAD_INPUT: "chat-audio-upload-input",
  IMAGE_PREVIEW_CONTAINER: "image-preview-container",
  FLOW_CONTINUE_BUTTON: "flow-continue-button",
  KNOWLEDGE_SECTION: "knowledge-section",
  KNOWLEDGE_FILE_INPUT: "knowledge-file-input",
  KNOWLEDGE_ADD_WEB_BUTTON: "knowledge-add-web-button",
  KNOWLEDGE_ADD_TEXT_BUTTON: "knowledge-add-text-button",
  KNOWLEDGE_EXPLORE_BUTTON: "knowledge-explore-button",
  KNOWLEDGE_SOURCE_ROW: "knowledge-source-row",
  KNOWLEDGE_WEB_URL_INPUT: "knowledge-web-url-input",
  KNOWLEDGE_WEB_SUBMIT: "knowledge-web-submit",
  KNOWLEDGE_TEXT_TITLE_INPUT: "knowledge-text-title-input",
  KNOWLEDGE_TEXT_BODY_INPUT: "knowledge-text-body-input",
  KNOWLEDGE_TEXT_SUBMIT: "knowledge-text-submit",
  KNOWLEDGE_EXPLORER: "knowledge-explorer",
  KNOWLEDGE_EXPLORER_QUERY_INPUT: "knowledge-explorer-query-input",
  KNOWLEDGE_CHUNK_ROW: "knowledge-chunk-row",
} as const;

export type TestId = (typeof TEST_IDS)[keyof typeof TEST_IDS];
