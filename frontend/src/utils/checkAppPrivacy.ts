import axios, { AxiosRequestConfig } from "axios";

export interface CheckIsPublicResult {
  isPublic: boolean;
  /** For embed mode: true when app can be embedded from the given origin (public or restricted with domain match) */
  embedAllowed?: boolean;
  error: Error | null;
}

// Cache for the most recent hashId check
let lastCheckedHashId: string | null = null;
let lastCheckedResult: CheckIsPublicResult | null = null;

// Map to track pending requests by hashId
const pendingRequests: Map<string, Promise<CheckIsPublicResult>> = new Map();

/**
 * Same base as `axiosInstance` so visibility checks hit the API when the UI is on
 * another origin. Plain `axios` is used here (not `axiosInstance`) to avoid
 * interceptor recursion with `checkCurrentPagePrivacy` → `checkIsPublic`.
 * When `NEXT_PUBLIC_API_URL` is unset, fall back to a same-origin `/api/...` path.
 */
function visibilityRequestUrl(hashId: string, embedOrigin?: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  const path = `/api/microapps/visibility/${hashId}`;
  let url = base ? `${base}${path}` : path;
  if (embedOrigin) {
    url += `?embed_origin=${encodeURIComponent(embedOrigin)}`;
  }
  return url;
}

/**
 * Makes an API request to check if the app is public
 * @param hashId - The hash ID of the app
 * @param signal - The abort signal for the request
 * @returns Promise with check public result
 */
const makeRequest = async (
  hashId: string,
  signal: AbortSignal | undefined,
  embedOrigin?: string
): Promise<CheckIsPublicResult> => {
  try {
    const config: AxiosRequestConfig = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (signal) {
      config.signal = signal;
    }

    const response = await axios.get(
      visibilityRequestUrl(hashId, embedOrigin),
      config
    );

    const data = response.data?.data ?? {};
    const result: CheckIsPublicResult = {
      isPublic: data.isPublic ?? false,
      embedAllowed: data.embedAllowed,
      error: null,
    };
    if (!embedOrigin) {
      lastCheckedHashId = hashId;
      lastCheckedResult = result;
    }
    return result;
  } catch (error: any) {
    const errorName = error?.name;
    if (
      errorName &&
      errorName !== "AbortError" &&
      errorName !== "CanceledError"
    ) {
      console.error("Error checking public status:", error);
    }

    const errorResult: CheckIsPublicResult = {
      isPublic: false,
      embedAllowed: false,
      error: error as Error,
    };

    // Don't cache error results from aborted requests
    if (!embedOrigin) {
      lastCheckedHashId = hashId;
      lastCheckedResult = errorResult;
    }
    throw error;
  }
};

/**
 * Check if the app is public and optionally whether embed is allowed from the given origin.
 * @param hashId - The hash ID of the app
 * @param signal - The abort signal for the request
 * @param embedOrigin - For embed mode: the parent page URL (e.g. document.referrer) to check domain allowlist
 * @returns The result of the check
 */
export const checkIsPublic = async (
  hashId: string,
  signal: AbortSignal | undefined,
  embedOrigin?: string
): Promise<CheckIsPublicResult> => {
  const cacheKey = `${hashId}:${embedOrigin ?? ""}`;
  const isSameCacheKey = cacheKey === `${lastCheckedHashId ?? ""}:${""}`;
  const isSameResult = lastCheckedResult !== null;
  const isNotError = lastCheckedResult?.error === null;
  // Only use cache when no embedOrigin (legacy path) and same hashId
  const canUseCache =
    !embedOrigin && hashId === lastCheckedHashId && isSameResult && isNotError;

  if (canUseCache) {
    return lastCheckedResult!;
  }

  // For production: reuse pending requests
  const pendingKey = cacheKey;
  if (pendingRequests.has(pendingKey)) {
    return pendingRequests.get(pendingKey)!.catch((error) => {
      // Only handle abort/cancel errors
      const isAborted =
        error?.name === "AbortError" || error?.name === "CanceledError";

      if (isAborted) {
        pendingRequests.delete(pendingKey);
        const newRequest = makeRequest(hashId, signal, embedOrigin).finally(
          () => {
            pendingRequests.delete(pendingKey);
          }
        );
        pendingRequests.set(pendingKey, newRequest);
        return newRequest;
      }

      // Rethrow other errors
      throw error;
    });
  }

  // Create the actual request and cleanup function
  const requestPromise = makeRequest(hashId, signal, embedOrigin).finally(
    () => {
      pendingRequests.delete(pendingKey);
    }
  );

  pendingRequests.set(pendingKey, requestPromise);

  return requestPromise;
};
