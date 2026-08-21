import { test as setup } from "@playwright/test";

setup("auth", async ({ page }) => {
  await page.goto("/accounts/login");

  // /accounts/login immediately redirects into Keycloak's own PKCE flow
  // (utils/keycloakAuth.ts) — if already authenticated, middleware.ts bounces
  // straight to /dashboard before that redirect ever fires.
  await page.waitForURL(/\/dashboard|\/auth\/realms\//);

  if (page.url().includes("/dashboard")) {
    await page.context().storageState({ path: "playwright/.auth/state.json" });
    return;
  }

  // Now on Keycloak's own hosted login page (a different origin/path than
  // this app — /auth/realms/<realm>/protocol/openid-connect/auth), not
  // anything this app renders. Field labels/button text are Keycloak's own
  // theme, not components/Login.tsx's.
  await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || "");
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD || "");

  await page.getByRole("button", { name: /Sign In|Log in/i }).click();

  // Keycloak redirects to /auth-callback (app/auth-callback/page.tsx), which
  // exchanges the code for tokens and then redirects to /dashboard itself.
  await page.waitForURL(/\/dashboard/);

  // localStorage, not sessionStorage — see the comment in
  // utils/keycloakAuth.ts on WebStorageStateStore for why. storageState()
  // captures localStorage; it cannot capture sessionStorage at all, which
  // would have silently broken every test relying on this saved state.
  await page.context().storageState({ path: "playwright/.auth/state.json" });
});
