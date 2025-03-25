import axios, { AxiosRequestConfig } from "axios";

interface CheckIsPublicResult {
  isPublic: boolean;
  error: Error | null;
}

// Cache for the most recent hashId check
let lastCheckedHashId: string | null = null;
let lastCheckedResult: CheckIsPublicResult | null = null;

// Map to track pending requests by hashId
const pendingRequests: Map<string, Promise<CheckIsPublicResult>> = new Map();

/**
 * Makes an API request to check if the app is public
 * @param hashId - The hash ID of the app
 * @param signal - The abort signal for the request
 * @returns Promise with check public result
 */
const makeRequest = async (
  hashId: string,
  signal: AbortSignal | undefined
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
      `/api/microapps/visibility/${hashId}`,
      config
    );

    // Cache the result
    const result = {
      isPublic: response.data.data.isPublic,
      error: null,
    };
    lastCheckedHashId = hashId;
    lastCheckedResult = result;

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

    const errorResult = {
      isPublic: false,
      error: error as Error,
    };

    // Don't cache error results from aborted requests
    lastCheckedHashId = hashId;
    lastCheckedResult = errorResult;

    throw error;
  }
};

/**
 * Check if the app is public
 * @param hashId - The hash ID of the app
 * @param signal - The abort signal for the request
 * @returns The result of the check
 */
export const checkIsPublic = async (
  hashId: string,
  signal: AbortSignal | undefined
): Promise<CheckIsPublicResult> => {
  const isSameHashId = hashId === lastCheckedHashId;
  const isSameResult = lastCheckedResult !== null;
  const isNotError = lastCheckedResult?.error === null;

  if (isSameHashId && isSameResult && isNotError) {
    return lastCheckedResult!;
  }

 
  // For production: reuse pending requests
  if (pendingRequests.has(hashId)) {
    return pendingRequests.get(hashId)!.catch(error => {
      // Only handle abort/cancel errors
      const isAborted = 
        error?.name === 'AbortError' || 
        error?.name === 'CanceledError';
      
      if (isAborted) {
        pendingRequests.delete(hashId);
        const newRequest = makeRequest(hashId, signal).finally(() => {
          pendingRequests.delete(hashId);
        });
        pendingRequests.set(hashId, newRequest);
        return newRequest;
      }
      
      // Rethrow other errors
      throw error;
    });
  }

  // Create the actual request and cleanup function
  const requestPromise = makeRequest(hashId, signal).finally(() => {
    // Remove this request from the pending requests map once completed
    pendingRequests.delete(hashId);
  });

  // Store the promise in the pending requests map
  pendingRequests.set(hashId, requestPromise);

  return requestPromise;
};
