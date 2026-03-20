"use client";

import { getAuthHeadersForFetch, refreshAccessToken } from "./accessTokenSession";

/**
 * fetch() with the same Bearer / refresh behavior as axiosInstance (non-public pages).
 * On 401, refreshes the access token once and retries (mirrors axios response interceptor).
 */
export async function authorizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : undefined;

  const mergeAuthAndFetch = async (
    retriedAfter401: boolean
  ): Promise<Response> => {
    const { headers: authHeaders, isPublic } = await getAuthHeadersForFetch(
      pathname,
      init?.signal ?? undefined
    );

    const headers = new Headers(init?.headers ?? undefined);
    if (authHeaders.Authorization) {
      headers.set("Authorization", authHeaders.Authorization);
    }

    const response = await fetch(input, {
      ...init,
      headers,
      credentials: init?.credentials ?? "include",
    });

    if (
      response.status === 401 &&
      !isPublic &&
      !retriedAfter401 &&
      init?.signal?.aborted !== true
    ) {
      try {
        await refreshAccessToken();
      } catch {
        return response;
      }
      return mergeAuthAndFetch(true);
    }

    return response;
  };

  return mergeAuthAndFetch(false);
}
