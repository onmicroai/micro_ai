import { test, expect } from "@playwright/test";
import path from "path";
import { TEST_APP_URL } from "./constants";

test("image-upload", async ({ page }) => {
  await page.goto(TEST_APP_URL);

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
});
