import { test, expect } from "@playwright/test";
import { TEST_IDS } from "../src/constants/testIds";

// Embedding the text goes through the LLM proxy, so allow some time.
const PROCESSING_TIMEOUT = 60_000;

test("paste text into the knowledge base, explore its chunks and remove it", async ({
  page,
}) => {
  const title = `Playwright notes ${Date.now()}`;
  const text =
    "The capital of Freedonia is Fredville. " +
    "Freedonia's national dish is a walnut pie served cold. ".repeat(20);

  await page.goto(process.env.TEST_APP_EDIT_URL || "");

  const section = page.getByTestId(TEST_IDS.KNOWLEDGE_SECTION);
  await expect(section).toBeVisible({ timeout: 10000 });

  // Add pasted text
  await section.getByTestId(TEST_IDS.KNOWLEDGE_ADD_TEXT_BUTTON).click();
  await page.getByTestId(TEST_IDS.KNOWLEDGE_TEXT_TITLE_INPUT).fill(title);
  await page.getByTestId(TEST_IDS.KNOWLEDGE_TEXT_BODY_INPUT).fill(text);
  await page.getByTestId(TEST_IDS.KNOWLEDGE_TEXT_SUBMIT).click();

  const row = section
    .getByTestId(TEST_IDS.KNOWLEDGE_SOURCE_ROW)
    .filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row.getByText(/Ready/)).toBeVisible({
    timeout: PROCESSING_TIMEOUT,
  });

  // Explore the extracted text
  await row.getByRole("button", { name: /See the text/ }).click();
  const explorer = page.getByTestId(TEST_IDS.KNOWLEDGE_EXPLORER);
  await expect(explorer).toBeVisible();
  const chunkRows = explorer.getByTestId(TEST_IDS.KNOWLEDGE_CHUNK_ROW);
  await expect(chunkRows.first()).toContainText("Freedonia");
  await expect(chunkRows.first()).toContainText(title);

  // Test query shows ranked matches
  await explorer
    .getByTestId(TEST_IDS.KNOWLEDGE_EXPLORER_QUERY_INPUT)
    .fill("What is the capital of Freedonia?");
  await explorer.getByRole("button", { name: "Test", exact: true }).click();
  await expect(explorer.getByText(/match(es)? for/)).toBeVisible({
    timeout: 15000,
  });
  await expect(chunkRows.first()).toContainText("% match");

  await page.keyboard.press("Escape");
  await expect(explorer).toBeHidden();

  // Clean up
  await row.getByRole("button", { name: "Remove from knowledge base" }).click();
  await expect(row).toHaveCount(0);
});

test("an internal address cannot be added as a web page", async ({ page }) => {
  await page.goto(process.env.TEST_APP_EDIT_URL || "");

  const section = page.getByTestId(TEST_IDS.KNOWLEDGE_SECTION);
  await expect(section).toBeVisible({ timeout: 10000 });
  const rowsBefore = await section
    .getByTestId(TEST_IDS.KNOWLEDGE_SOURCE_ROW)
    .count();

  await section.getByTestId(TEST_IDS.KNOWLEDGE_ADD_WEB_BUTTON).click();
  await page
    .getByTestId(TEST_IDS.KNOWLEDGE_WEB_URL_INPUT)
    .fill("http://127.0.0.1:8000/");
  await page.getByTestId(TEST_IDS.KNOWLEDGE_WEB_SUBMIT).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(section.getByTestId(TEST_IDS.KNOWLEDGE_SOURCE_ROW)).toHaveCount(
    rowsBefore
  );
});
