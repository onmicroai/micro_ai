// import { test, expect } from "@playwright/test";
// import { TEST_APP_EDIT_URL } from "./constants";

// test("AI models select test", async ({ page }) => {
//   await page.goto(TEST_APP_EDIT_URL);

//   // Wait for the page to load and find the label "AI Model" (or "AI models" - case insensitive)
//   const aiModelLabel = page.getByText(/AI models?/i).first();
//   await expect(aiModelLabel).toBeVisible({ timeout: 10000 });

//   // Find the select/combobox associated with this label
//   // The select is in the same container (div) as the label
//   const selectContainer = aiModelLabel.locator("..");
//   const selectTrigger = selectContainer.getByRole("combobox").first();

//   // Wait for the select to be ready and click to open the dropdown
//   await expect(selectTrigger).toBeVisible();
//   await selectTrigger.click();

//   // Wait for the listbox (dropdown options) to appear
//   const listbox = page.getByRole("listbox");
//   await expect(listbox).toBeVisible({ timeout: 5000 });

//   // Get all option items in the listbox
//   const options = listbox.getByRole("option");
//   const optionCount = await options.count();

//   // Verify that there are options and the list is not empty
//   expect(
//     optionCount,
//     `AI models dropdown should have at least one option, but found ${optionCount}`
//   ).toBeGreaterThan(0);

//   // Also verify that at least one option is visible and has text
//   const firstOption = options.first();
//   await expect(firstOption).toBeVisible();
//   const firstOptionText = await firstOption.textContent();
//   expect(firstOptionText?.trim().length).toBeGreaterThan(0);
// });
