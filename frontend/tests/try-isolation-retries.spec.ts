import { expect, test } from "@playwright/test";

/**
 * Regression guard for try isolation.
 *
 * This test targets the exact class of bugs where try 2 leaks state into try 1:
 * - edited answers overwriting previous tries
 * - failed score visibility disappearing/reappearing unexpectedly
 * - fields below scoring appearing in older tries after newer try succeeds
 *
 * Configure TEST_TRY_ISOLATION_APP_URL to a debate-style app that:
 * 1) reaches required scoring,
 * 2) can fail first score,
 * 3) allows retry editing.
 */
test("tries stay isolated across edit/retry/success paths", async ({ page }) => {
  test.setTimeout(120000);

  const appUrl = process.env.TEST_TRY_ISOLATION_APP_URL;
  test.skip(!appUrl, "TEST_TRY_ISOLATION_APP_URL not configured");

  await page.goto(appUrl || "");

  const responseField = page
    .getByLabel(/Please respond to the opening argument from the AI/i)
    .or(page.getByRole("textbox", { name: /opening argument/i }))
    .first();

  const continueButton = page.getByRole("button", { name: /^Continue$/i });
  const evaluateButton = page.getByRole("button", { name: /^Evaluate$/i });
  const scoreToggle = page.getByRole("button", { name: /Score/i }).last();

  // Reach the scoring stop and intentionally fail once.
  await responseField.fill("Short first answer that should fail scoring.");
  await continueButton.click();
  await evaluateButton.click();
  await expect(page.getByText(/Did not pass the Minimum Score/i)).toBeVisible();

  const originalTryAnswer = await responseField.inputValue();

  // Edit and save -> expect new try 2/2.
  await page.getByRole("button", { name: /^Edit$/i }).first().click();
  await responseField.fill("Second try edited answer.");
  await page.getByRole("button", { name: /Save changes/i }).click();
  await expect(page.getByText("2/2")).toBeVisible();

  // Go back to 1/2 and ensure original answer + failed score are still there.
  await page.locator("button").filter({ has: page.locator("svg") }).first().click();
  await expect(page.getByText("1/2")).toBeVisible();
  await expect(responseField).toHaveValue(originalTryAnswer);
  await expect(page.getByText(/Did not pass the Minimum Score/i)).toBeVisible();
  await scoreToggle.click();
  await expect(page.getByText(/Score:\s*0\s*(\/|out of)\s*2/i)).toBeVisible();

  // Return to 2/2 and run a successful retry.
  await page.locator("button").filter({ has: page.locator("svg") }).nth(1).click();
  await expect(page.getByText("2/2")).toBeVisible();
  // The prior AI response card for this try should remain visible before rerunning.
  await expect(page.locator("div.bg-gradient-to-b").first()).toBeVisible();
  await continueButton.click();
  await evaluateButton.click();

  // If score passes, downstream content may appear in 2/2.
  // Navigate back to 1/2 and ensure it does NOT inherit 2/2 downstream visibility.
  await page.locator("button").filter({ has: page.locator("svg") }).first().click();
  await expect(page.getByText("1/2")).toBeVisible();
  await expect(responseField).toHaveValue(originalTryAnswer);
  await expect(page.getByText(/Did not pass the Minimum Score/i)).toBeVisible();
  await scoreToggle.click();
  await expect(page.getByText(/Score:\s*0\s*(\/|out of)\s*2/i)).toBeVisible();
});

