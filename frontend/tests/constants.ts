/**
 * Constants for e2e testing.
 */

/** Frontend base URL (overridable via PLAYWRIGHT_BASE_URL for post-deploy E2E). */
export const TEST_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.TEST_BASE_URL || "http://localhost";
export const TEST_USER_EMAIL = "micro-ai-user@mailinator.com";
export const TEST_USER_PASSWORD = "Test123!";
export const TEST_APP_HASH_ID = "7cc04575-9e9c-4f";
export const TEST_APP_URL = `/app/${TEST_APP_HASH_ID}`;
/** API base URL (overridable via PLAYWRIGHT_API_BASE_URL or NEXT_PUBLIC_API_URL). */
export const TEST_API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";
