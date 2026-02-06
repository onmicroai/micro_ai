import { test, expect } from "@playwright/test";
import path from "path";
import { TEST_APP_URL, TEST_API_BASE_URL } from "./constants";
import {
  collectRunUuids,
  verifyRunsPersistedAndCharged,
} from "./utils/runVerification";

test("All fields types app test", async ({ page, request }) => {
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

  // Name field: find label, then get the parent div, then find input inside it
  const nameContainer = page.getByText("What is your name?").locator("..");
  await nameContainer.locator("input").fill(name);

  await page
    .getByRole("textbox", { name: "What are your hobbies?" })
    .fill(hobbies);

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

  await verifyRunsPersistedAndCharged(runUuids, request, {
    apiBaseUrl: TEST_API_BASE_URL,
    page,
    expect,
    settleDelayMs: 2000,
  });
});
