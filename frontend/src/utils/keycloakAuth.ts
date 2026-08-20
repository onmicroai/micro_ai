"use client";

import { UserManager, WebStorageStateStore, User } from "oidc-client-ts";
import Cookies from "js-cookie";

/**
 * Marker cookie only — never carries token material. Exists purely so
 * middleware.ts (which runs on the edge, can't read sessionStorage) can keep
 * doing presence-only route gating, same posture as today's non-HttpOnly
 * access_token cookie (utils/tokenCookieUtils.ts) — parity, not a regression.
 */
export const SESSION_PRESENT_COOKIE = "kc_session_present";

const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "";
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "onmicro";
const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "onmicro-spa";

let userManagerSingleton: UserManager | null = null;

/**
 * Browser-only singleton. Refresh-token based silent renewal (oidc-client-ts's
 * default when a refresh_token is present, per automaticSilentRenew), not
 * iframe-based silent-check-sso — this app embeds inside cross-site LMS
 * iframes (apps/lti/middleware.py, SameSite=None cookies), where
 * third-party-cookie blocking makes hidden-iframe silent-SSO checks
 * unreliable in exactly that embedding context.
 */
export function getUserManager(): UserManager {
   if (typeof window === "undefined") {
      throw new Error("getUserManager() must only be called in the browser");
   }
   if (!userManagerSingleton) {
      if (!KEYCLOAK_URL) {
         throw new Error("NEXT_PUBLIC_KEYCLOAK_URL is not set");
      }
      userManagerSingleton = new UserManager({
         authority: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
         client_id: KEYCLOAK_CLIENT_ID,
         // Not /auth/callback — nginx's ^/auth/ block (docker-compose*.yml,
         // KC_HTTP_RELATIVE_PATH=/auth) routes every /auth/* path straight to
         // Keycloak itself, never to this Next.js app. Any callback route
         // under /auth/ would be unreachable by the browser.
         redirect_uri: `${window.location.origin}/auth-callback`,
         post_logout_redirect_uri: window.location.origin,
         response_type: "code",
         scope: "openid profile email",
         userStore: new WebStorageStateStore({ store: window.sessionStorage }),
         automaticSilentRenew: true,
      });
   }
   return userManagerSingleton;
}

export function markSessionPresent(): void {
   const isProduction = process.env.NODE_ENV === "production";
   Cookies.set(SESSION_PRESENT_COOKIE, "1", {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
   });
}

export function clearSessionPresent(): void {
   Cookies.remove(SESSION_PRESENT_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
   return getUserManager().getUser();
}
