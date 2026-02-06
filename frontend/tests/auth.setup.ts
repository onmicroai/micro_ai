import { test as setup } from "@playwright/test";

setup("auth", async ({ page }) => {
  await page.goto("/accounts/login");

  // If you got redirected, you're already logged in
  if (!page.url().includes("/accounts/login")) {
    await page.context().storageState({ path: "playwright/.auth/state.json" });
    return;
  }

  // Otherwise, perform login.
  await page.getByLabel(/email/i).fill("micro-ai-user@mailinator.com");
  await page.getByLabel(/password/i).fill("Test123!");

  await page.getByRole("button", { name: /Sign in|Log in/ }).click();

  // Wait until logged in
  await page.waitForURL(/\/dashboard/);

  await page.context().storageState({ path: "playwright/.auth/state.json" });
});
