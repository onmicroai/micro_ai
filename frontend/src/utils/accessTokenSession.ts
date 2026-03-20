/**
 * Shared JWT/session behavior for the browser: refresh queue, public-app check,
 * and header resolution for fetch + axios.
 */
"use client";

import axios from "axios";
import { checkIsPublic } from "./checkAppPrivacy";
import isTokenExpired from "./isTokenExpired";
import {
  getAccessToken as getCookieAccessToken,
  getAccessTokenExpiration,
  setAccessToken,
  removeAccessToken,
} from "./tokenCookieUtils";

export const forceLogout = async (
  error: any,
  isPublic?: boolean
): Promise<void> => {
  console.error("forceLogout", error);

  try {
    await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout/`,
      {},
      {
        withCredentials: true,
      }
    );
  } catch (logoutErr: any) {
    console.error("Error logging out:", logoutErr);
  } finally {
    removeAccessToken();
    if (!isPublic) {
      window.location.href = "/accounts/login";
    }
  }
};

/**
 * Single refresh queue shared by axios and authorizedFetch.
 */
export const refreshAccessToken: () => Promise<string | null> = (() => {
  let isRefreshing = false;
  const pendingRequests: Array<
    (error: any, token: string | null) => void
  > = [];

  const processQueue = (error: any, token: string | null = null) => {
    pendingRequests.forEach((callback) => {
      if (error) {
        callback(error, null);
      } else {
        callback(null, token);
      }
    });
    pendingRequests.length = 0;
  };

  return async (): Promise<string | null> => {
    if (isRefreshing) {
      return new Promise<string | null>((resolve, reject) => {
        pendingRequests.push((error, token) => {
          if (error) {
            reject(error);
          } else {
            resolve(token);
          }
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post(
        `/api/auth/token/refresh/`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      const { access, access_expiration } = data;
      setAccessToken(access, access_expiration.toString());

      processQueue(null, access);
      return access;
    } catch (error: any) {
      processQueue(error, null);
      if (error.name !== "CanceledError") {
        if (error?.response?.status === 401) {
          let isPublic = false;
          if (typeof window !== "undefined") {
            isPublic = await checkCurrentPagePrivacy(window.location.pathname);
          }
          forceLogout(error, isPublic);
        }
      }
      throw error;
    } finally {
      isRefreshing = false;
    }
  };
})();

let lastCheckedPath: string | null = null;
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

export async function checkCurrentPagePrivacy(
  path: string | undefined,
  signal?: AbortSignal
): Promise<boolean> {
  if (path === undefined) return false;

  if (!path.includes("/app/")) return false;

  if (path === lastCheckedPath) return lastCheckedPathVisibility;

  const appId = extractMicroappHashFromPath(path);

  if (!appId) {
    return false;
  }

  try {
    const result = await checkIsPublic(appId, signal);

    lastCheckedPath = path;
    lastCheckedPathVisibility = result.isPublic;

    return result.isPublic;
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

  let accessToken = getCookieAccessToken();

  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  const expirationTime = getAccessTokenExpiration();

  if (isTokenExpired(expirationTime)) {
    accessToken = await refreshAccessToken();
  }

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return { headers, isPublic: false };
}
