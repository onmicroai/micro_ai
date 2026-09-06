/**
 * Shared session behavior for the browser: public-app check and header
 * resolution for fetch + axios. Token source is Keycloak (utils/keycloakAuth.ts)
 * — checkCurrentPagePrivacy and friends below are unchanged from the old
 * cookie-based engine, since public-app detection has nothing to do with
 * which auth engine issues the token.
 */
"use client";

import { checkIsPublic } from "./checkAppPrivacy";
import { getKeycloakAccessToken, getUserManager } from "./keycloakAuth";

export const forceLogout = async (
  error: any,
  isPublic?: boolean
): Promise<void> => {
  console.error("forceLogout", error);

  try {
    // Clears local session state. Does not itself do RP-initiated logout
    // (signoutRedirect) — this fires from request-failure paths where we
    // want to drop stale local tokens and bounce to login, not necessarily
    // tear down the Keycloak-side session too.
    await getUserManager().removeUser();
  } catch (logoutErr: any) {
    console.error("Error clearing Keycloak session:", logoutErr);
  } finally {
    if (!isPublic) {
      window.location.href = "/accounts/login";
    }
  }
};

/**
 * Force-refreshes the access token now, regardless of remaining lifetime.
 * Used by the 401-retry paths in axiosInstance/authorizedFetch, where the
 * server has already told us the current token doesn't work.
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const user = await getUserManager().signinSilent();
    return user?.access_token ?? null;
  } catch (error: any) {
    if (error?.name !== "CanceledError") {
      let isPublic = false;
      if (typeof window !== "undefined") {
        isPublic = await checkCurrentPagePrivacy(window.location.pathname);
      }
      forceLogout(error, isPublic);
    }
    throw error;
  }
};

let lastCheckedKey: string | null = null;
let lastCheckedPathVisibility: boolean = false;

/**
 * Resolves the microapp hash from the browser path (not the API path).
 * Examples: `/app/abc-123`, `/app/edit/abc-123`, `/app/embed/abc-123`, `/app/abc-123/stats`.
 */
function extractMicroappHashFromPath(path: string): string | null {
  const pathname = path.split("?")[0] ?? path;
  if (!pathname.includes("/app/")) {
    return null;
  }

  const editEmbed = pathname.match(/^\/app\/(?:edit|embed)\/([^/]+)/i);
  if (editEmbed?.[1]) {
    return editEmbed[1];
  }

  const direct = pathname.match(/^\/app\/([^/]+)/i);
  const seg = direct?.[1];
  if (!seg || /^edit$/i.test(seg) || /^embed$/i.test(seg)) {
    return null;
  }
  return seg;
}

/**
 * Returns true if the path is an embed path (/app/embed/...). Edit paths are excluded.
 */
function isEmbedPath(path: string): boolean {
  return /^\/app\/embed\/([^/]+)/i.test(path.split("?")[0] ?? path);
}

export async function checkCurrentPagePrivacy(
  path: string | undefined,
  signal?: AbortSignal
): Promise<boolean> {
  if (path === undefined) return false;

  if (!path.includes("/app/")) return false;

  const barePath = path.split("?")[0] ?? path;
  // Logged-in surfaces: never treat as "public viewer" for auth purposes. A
  // public app still uses IsAuthenticated APIs here; omitting the Bearer
  // causes 401, and authorizedFetch skips 401 retry when isPublic is true
  // (unlike axios).
  if (/\/app\/edit\//i.test(barePath)) {
    return false;
  }
  if (/\/app\/[^/]+\/stats(?:\/|$)/i.test(barePath)) {
    return false;
  }

  const appId = extractMicroappHashFromPath(path);
  if (!appId) return false;

  // For embed paths, include referrer in cache key since result depends on it
  const embedOrigin =
    isEmbedPath(path) && typeof document !== "undefined"
      ? document.referrer || ""
      : undefined;
  const cacheKey = `${path}|${embedOrigin ?? ""}`;
  if (cacheKey === lastCheckedKey) return lastCheckedPathVisibility;

  try {
    const result = await checkIsPublic(appId, signal, embedOrigin);

    lastCheckedKey = cacheKey;
    // Treat as "public" (no auth required) when app is public OR embed is allowed from this origin
    lastCheckedPathVisibility =
      result.isPublic || result.embedAllowed === true;

    return lastCheckedPathVisibility;
  } catch (error: any) {
    if (error.name !== "AbortError" && error.name !== "CanceledError") {
      console.error("Error checking app visibility:", error);
    }
    return false;
  }
}

/**
 * Same rules as the axios request interceptor: optional Bearer for non-public routes.
 */
export async function getAuthHeadersForFetch(
  pathname: string | undefined,
  signal?: AbortSignal
): Promise<{ headers: Record<string, string>; isPublic: boolean }> {
  const isPublic = await checkCurrentPagePrivacy(pathname, signal);

  if (isPublic) {
    return { headers: {}, isPublic: true };
  }

  // getKeycloakAccessToken's default minRemainingSeconds proactively renews
  // here if the token is close to expiring — this is the SSE-safety
  // preflight: streamRun.ts/chat-build-sidebar.tsx open their stream via
  // authorizedFetch, which resolves headers through this same function.
  const accessToken = await getKeycloakAccessToken();

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return { headers, isPublic: false };
}
