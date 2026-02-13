import { test, expect } from "@playwright/test";
import path from "path";
import { TEST_APP_URL, TEST_API_BASE_URL } from "./constants";
import {
  collectRunUuids,
  verifyRunsPersistedAndCharged,
} from "./utils/runVerification";

test("Basic fields types app test", async ({ page, request }) => {
  const runUuids = collectRunUuids(page, { includeAnonymous: true });

  const name = "John";
  const hobbies = "Golf, crossword puzzles";
  const nativeLanguage = "Ukranian";
  const pets = "Dog";
  const marvelMovies = "No";
  const siblingsCount = "1";
  // Switch is toggled once from default (true → false), so we expect "No" for spicy food
  const likeSpicyFood = "No";

  await page.goto(TEST_APP_URL);

  // Name field: find by label, then locate input in same container
  const nameLabel = page.getByText("What is your name?");
  await nameLabel.waitFor({ state: "visible" });
  const nameInput = nameLabel.locator("..").locator("input").first();

  // Use pressSequentially which is better for React controlled inputs
  await nameInput.click();
  await nameInput.fill(""); // Clear first
  await nameInput.pressSequentially(name, { delay: 20 });
  // Verify the input has the value
  await expect(nameInput).toHaveValue(name);
  // Trigger additional events to ensure React state updates
  await nameInput.press("Tab"); // Tab away to trigger blur
  await page.waitForTimeout(300);

  // Hobbies field
  const hobbiesLabel = page.getByText("What are your hobbies?");
  await hobbiesLabel.waitFor({ state: "visible" });
  const hobbiesInput = hobbiesLabel
    .locator("..")
    .locator("textarea")
    .or(page.getByRole("textbox", { name: "What are your hobbies?" }))
    .first();

  // Use pressSequentially which is better for React controlled inputs
  await hobbiesInput.click();
  await hobbiesInput.fill(""); // Clear first
  await hobbiesInput.pressSequentially(hobbies, { delay: 20 });
  // Verify the textarea has the value
  await expect(hobbiesInput).toHaveValue(hobbies);
  // Trigger additional events to ensure React state updates
  await hobbiesInput.press("Tab"); // Tab away to trigger blur
  await page.waitForTimeout(300);

  await page.getByRole("radio", { name: nativeLanguage }).check();
  await page.getByRole("checkbox", { name: pets }).check();

  await page
    .locator("div")
    .filter({ hasText: /^Select\.\.\.$/ })
    .nth(2)
    .click();
  await page.getByRole("option", { name: marvelMovies }).click();

  await page
    .getByRole("slider", { name: "How many siblings do you have?" })
    .fill(siblingsCount);

  await page.getByRole("switch").click();

  //=======================================================================

  const filePath = path.resolve(__dirname, "fixtures/cat.jpg");

  // Anchor to the dropzone in THIS component
  const dropzone = page.getByText(/Drag & drop.*click to select/i);

  // The input is inside the dropzone root element
  const input = dropzone.locator("..").locator('input[type="file"]');
  await expect(input).toHaveCount(1); // sanity
  await input.setInputFiles(filePath);

  const preview = page.getByTestId("image-preview-container");
  await expect(preview).toBeVisible({ timeout: 15000 });

  // Next/Image renders a real <img> eventually
  await expect(preview.locator('img[alt^="Upload"]')).toHaveCount(1);

  // Wait a bit more before submitting to ensure form state is fully updated
  await page.waitForTimeout(500);

  // Verify inputs still have values right before submitting (ensures React state is synced)
  const nameInputFinal = page
    .getByText("What is your name?")
    .locator("..")
    .locator("input")
    .first();
  await expect(nameInputFinal).toHaveValue(name);
  const hobbiesInputFinal = page.getByRole("textbox", {
    name: "What are your hobbies?",
  });
  await expect(hobbiesInputFinal).toHaveValue(hobbies);

  //=======================================================================

  await page.getByRole("button", { name: "Continue" }).click();

  // Expect the fixed response container to show interpolated name and siblings count
  const fixedResponseContainer = page
    .locator("div")
    .filter({ hasText: "OK, now that you've provided" });
  await expect(fixedResponseContainer.first()).toContainText(name);
  await expect(fixedResponseContainer.first()).toContainText(siblingsCount);

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // After Continue, expect a container with the AI summary to show all filled data
  const detailsContainer = page.locator("div").filter({
    hasText: /Sure! Here are your details|your details|Name:|Hobbies:/i,
  });
  await expect(detailsContainer.first()).toContainText(name);
  await expect(detailsContainer.first()).toContainText(hobbies);
  await expect(detailsContainer.first()).toContainText(nativeLanguage);
  await expect(detailsContainer.first()).toContainText(pets);
  await expect(detailsContainer.first()).toContainText(marvelMovies);
  await expect(detailsContainer.first()).toContainText(siblingsCount);
  await expect(detailsContainer.first()).toContainText(likeSpicyFood);

  await page.getByRole("button", { name: "Continue" }).click();

  // Expect a container with the image analysis response (generic: mentions image and cat)
  const imageAnalysisContainer = page.locator("div").filter({
    hasText: /image.*cat|cat.*image/i,
  });

  await expect(imageAnalysisContainer.first()).toBeVisible();

  // Click Continue after image analysis
  await page.getByRole("button", { name: "Continue" }).click();

  // Wait for the score/end screen to load - scoring can take time, so use longer timeout
  await page.waitForFunction(
    () => {
      const bodyText = document.body.textContent || "";
      return (
        /Score/i.test(bodyText) &&
        /You've reached the end|You have reached the end/i.test(bodyText)
      );
    },
    { timeout: 30000 } // 30 seconds for scoring to complete
  );

  // Expect to see "Score" text (could be in button, div, span, etc.)
  const scoreElement = page
    .locator("*")
    .filter({ hasText: /^Score$/i })
    .first();
  await expect(scoreElement).toBeVisible({ timeout: 10000 });

  // Click on "Score" to expand/show the score details
  await scoreElement.click();

  // Wait for the JSON score content to appear after clicking
  await page.waitForFunction(
    () => {
      const bodyText = document.body.textContent || "";
      return /"total"\s*:\s*"3"/i.test(bodyText);
    },
    { timeout: 10000 }
  );

  // Expect to see "total": "3" in the JSON
  const scoreContent = page.locator("*").filter({
    hasText: /"total"\s*:\s*"3"/i,
  });
  await expect(scoreContent.first()).toBeVisible({ timeout: 5000 });

  // Expect to see "You've reached the end" text
  const endMessage = page
    .getByText(/You've reached the end|You have reached the end/i)
    .first();
  await expect(endMessage).toBeVisible({ timeout: 5000 });

  await verifyRunsPersistedAndCharged(runUuids, request, {
    apiBaseUrl: TEST_API_BASE_URL,
    page,
    expect,
    settleDelayMs: 2000,
  });
});
