import { test as setup } from "@playwright/test";

setup("auth", async ({ page }) => {
  await page.goto("/accounts/login");

  // If you got redirected, you're already logged in
  if (!page.url().includes("/accounts/login")) {
    await page.context().storageState({ path: "playwright/.auth/state.json" });
    return;
  }

  // Otherwise, perform login.
  await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || "");
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || "");

  await page.getByRole("button", { name: /Sign in|Log in/ }).click();

  // Wait until logged in
  await page.waitForURL(/\/dashboard/);

  await page.context().storageState({ path: "playwright/.auth/state.json" });
});
