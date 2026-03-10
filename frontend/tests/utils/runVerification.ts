import type { APIRequestContext, Page } from "@playwright/test";

const MAX_ATTEMPTS = 3;

/**
 * Attaches a request listener to the page to collect run_uuid from each POST to /api/microapps/run
 * (and optionally /run/anonymous). Call this at the start of the test; the returned array is
 * populated as requests happen.
 *
 * @param page - Playwright page
 * @param options.includeAnonymous - If true, also collect from POST .../run/anonymous (default false)
 * @returns The same array that will be pushed to (so the test can pass it to verifyRunsPersistedAndCharged later)
 */
export function collectRunUuids(
  page: Page,
  options?: { includeAnonymous?: boolean }
): string[] {
  const runUuids: string[] = [];
  const includeAnonymous = options?.includeAnonymous ?? false;
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    const url = req.url();
    const isRunPost =
      url.includes("/api/microapps/run") &&
      (url.endsWith("/run") ||
        (includeAnonymous && url.includes("/run/anonymous")));
    if (isRunPost) {
      try {
        const body = req.postDataJSON();
        if (body?.run_uuid) runUuids.push(body.run_uuid);
      } catch {
        // ignore
      }
    }
  });
  return runUuids;
}

const RETRY_DELAY_MS = 1000;
const SETTLE_DELAY_MS = 2000;

/**
 * Verifies that each run is persisted (GET returns 200), and that each run has cost > 0 and credits > 0.
 * Retries GET up to MAX_ATTEMPTS with RETRY_DELAY_MS between attempts.
 * Optionally waits SETTLE_DELAY_MS before starting (e.g. for streaming runs to be saved).
 */
export async function verifyRunsPersistedAndCharged(
  runUuids: string[],
  request: APIRequestContext,
  options: {
    apiBaseUrl: string;
    page?: Page;
    expect: (
      actual: unknown,
      message?: string
    ) => ReturnType<typeof import("@playwright/test").expect>;
    settleDelayMs?: number;
  }
): Promise<void> {
  const { apiBaseUrl, page, expect, settleDelayMs = SETTLE_DELAY_MS } = options;

  if (page && settleDelayMs > 0) {
    await page.waitForTimeout(settleDelayMs);
  }

  for (const runUuid of runUuids) {
    const url = `${apiBaseUrl}/api/microapps/run/${runUuid}/`;
    let res = await request.get(url);
    for (
      let attempt = 1;
      attempt <= MAX_ATTEMPTS && res.status() === 404;
      attempt++
    ) {
      if (attempt < MAX_ATTEMPTS && page) {
        await page.waitForTimeout(RETRY_DELAY_MS);
      }
      res = await request.get(url);
    }

    expect(
      res.status(),
      `Run ${runUuid} should be retrievable (200) from ${url}`
    ).toBe(200);

    const body = await res.json();
    const run = body?.data;
    expect(run, `Run ${runUuid} response should have data`).toBeTruthy();
    expect(
      typeof run.cost === "number" && run.cost > 0,
      `Run ${runUuid} should have cost > 0, got: ${run.cost}`
    ).toBe(true);
    expect(
      typeof run.credits === "number" && run.credits > 0,
      `Run ${runUuid} should have credits > 0, got: ${run.credits}`
    ).toBe(true);
  }
}
