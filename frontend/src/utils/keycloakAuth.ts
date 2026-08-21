"use client";

import { UserManager, WebStorageStateStore, User } from "oidc-client-ts";
import Cookies from "js-cookie";

/**
 * Marker cookie only — never carries token material. Exists purely so
 * middleware.ts (which runs on the Edge Runtime, can't read localStorage)
 * can keep doing presence-only route gating, same posture as the old
 * non-HttpOnly access_token cookie (deleted utils/tokenCookieUtils.ts) —
 * parity, not a regression.
 */
export const SESSION_PRESENT_COOKIE = "kc_session_present";

const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "";
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "onmicro";
const KEYCLOAK_CLIENT_ID =
  process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "onmicro-spa";

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
      userStore: new WebStorageStateStore({ store: window.localStorage }),
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

/**
 * Module-level cache mirroring the current user, kept in sync via
 * oidc-client-ts's own events — same pattern KeycloakAuthContext uses via
 * React state, but for the non-component call sites below (userStore,
 * useMicroappAccess) that need a synchronous-ish read rather than awaiting a
 * promise on every render. Only ever set after getUser()'s first resolution,
 * so the very first read before that completes can be a false negative —
 * the same class of caveat the old cookie-read approach had too.
 */
let cachedUser: User | null = null;
let cacheSubscribed = false;

function ensureCacheSubscribed(): void {
  if (cacheSubscribed) return;
  cacheSubscribed = true;
  const userManager = getUserManager();
  userManager.getUser().then((user: User | null) => {
    cachedUser = user;
  });
  userManager.events.addUserLoaded((user: User) => {
    cachedUser = user;
  });
  userManager.events.addUserUnloaded(() => {
    cachedUser = null;
  });
}

export function hasValidSessionSync(): boolean {
  if (typeof window === "undefined") return false;
  ensureCacheSubscribed();
  return !!cachedUser && !cachedUser.expired;
}

/**
 * The access token to actually send on a request. Proactively renews first
 * if the current token is within `minRemainingSeconds` of expiring — this is
 * what makes the SSE streaming path safe: authorizedFetch (used by
 * streamRun.ts and chat-build-sidebar.tsx to open a stream) always resolves
 * headers through here, so a stream is never opened with a token that's
 * about to die mid-read. oidc-client-ts's automaticSilentRenew already
 * refreshes proactively in the background on a timer, but that timer can
 * miss (e.g. the tab was backgrounded/suspended) — this is the synchronous
 * guarantee, checked right before the request fires, not just a background
 * best-effort.
 */
export async function getKeycloakAccessToken(
  minRemainingSeconds = 60
): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const userManager = getUserManager();
  let user = await userManager.getUser();

  if (!user || user.expired) {
    return null;
  }

  if (user.expires_in !== undefined && user.expires_in < minRemainingSeconds) {
    try {
      user = await userManager.signinSilent();
    } catch (err) {
      console.error("Keycloak silent renew failed:", err);
      // Fall through with whatever token we already have — the caller's
      // own 401 handling is the backstop if it turns out to be too stale.
    }
  }

  return user?.access_token ?? null;
}
