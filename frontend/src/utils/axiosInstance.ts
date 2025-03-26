// \microai-frontend\app\utils\axiosInstance.ts

/**
 * It currently works only on client, because it uses LocalStorage for the storaging access token
 */
"use client";

import axios, { AxiosInstance } from "axios";
import { checkIsPublic } from "./checkAppPrivacy";
/**
 * Singleton, that manages a queue of requests for access token update.
 * Prevents multiple API requests for access token update at the same time
 *
 * @returns {() => Promise<string | null>}
 */
const getAccessTokenSingleton = (): (() => Promise<string | null>) => {
  let isRefreshing = false;
  let pendingRequests: Array<(error: any, token: string | null) => void> = [];

  const processQueue = (error: any, token: string | null = null) => {
    pendingRequests.forEach((callback) => {
      if (error) {
        callback(error, null);
      } else {
        callback(null, token);
      }
    });
    pendingRequests = [];
  };

  return async (): Promise<string | null> => {
    if (isRefreshing) {
      // If a request is already in progress, return a promise that resolves
      const tokenPromise = new Promise<string | null>((resolve, reject) => {
        pendingRequests.push((error, token) => {
          if (error) {
            reject(error);
          } else {
            resolve(token);
          }
        });
      });

      return tokenPromise;
    }

    isRefreshing = true; // Set loading state
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
      localStorage.setItem("accessToken", access);
      localStorage.setItem(
        "accessTokenExpiration",
        access_expiration.toString()
      );

      processQueue(null, access);
      return access; // Return access as a string
    } catch (error: any) {
      processQueue(error, null);
      // If refresh token is expired, clear tokens and redirect to login
      if (error.name !== "CanceledError") {
        console.error("........getAccessToken error........", error);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("accessTokenExpiration");
        window.location.href = "/accounts/login";
      }
      throw error;
    } finally {
      isRefreshing = false;
    }
  };
};

/**
 * Checks if token is expired or not
 *
 * @returns {Boolean}
 */
const isTokenExpired = (expirationTime: string | null): boolean => {
  if (expirationTime === null) {
    return true;
  }

  const expirationDate = new Date(expirationTime);
  const currentTime = new Date();
  return currentTime >= expirationDate;
};

/**
 * Singleton returns axios configured instance.
 * Prevents creation of the axios configuration for the multiple times
 *
 * @returns {() => AxiosInstance}
 */
const axiosInstanceSingleton = (): (() => AxiosInstance) => {
  let api: AxiosInstance | null = null;
  const getAccessToken = getAccessTokenSingleton();
  // Cache variables for path visibility
  let lastCheckedPath: string | null = null;
  let lastCheckedPathVisibility: boolean = false;

  /**
   * Checks if the current page or API request is public or not
   * @param path - The current pathname
   * @param signal - Optional AbortSignal for cancelling the request
   * @returns {Boolean} - True if the page/request is public, false otherwise
   */
  const checkCurrentPagePrivacy = async (
    path: string | undefined,
    signal?: AbortSignal
  ): Promise<boolean> => {
    if (path === undefined) return false;

    // If path doesn't contain /app/, return false
    if (!path.includes("/app/")) return false;

    if (path === lastCheckedPath) return lastCheckedPathVisibility;

    // Extract app ID from the pathname (client-side route) or API URL
    const appIdMatch = path?.match(/\/microapps\/.*?\/([a-zA-Z0-9-]+)/);

    const appId = appIdMatch ? appIdMatch[1] : null;

    // If no app ID found or it's not a microapp path, return false
    if (!appId) {
      return false;
    }

    try {
      const result = await checkIsPublic(appId, signal);

      // Update our cache with the new path and visibility status
      lastCheckedPath = path;
      lastCheckedPathVisibility = result.isPublic;

      return result.isPublic;
    } catch (error: any) {
      // Don't log aborted requests as errors
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        console.error("Error checking app visibility:", error);
      }
      // In case of error, default to not public
      return false;
    }
  };

  return () => {
    if (api !== null) {
      return api;
    }

    api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      headers: {
        "Content-Type": "application/json",
      }
    });

    api.interceptors.request.use(
      async (config: any) => {
        const path = window.location.pathname;
        // Check if the request URL or current page is for a public app
        const isPublic = await checkCurrentPagePrivacy(path, config.signal);

        let accessToken = localStorage.getItem("accessToken");

        if (!accessToken && isPublic) {
          return config;
        }

        // Normal token handling for non-public or unknown pages
        const expirationTime = localStorage.getItem("accessTokenExpiration");

        if (isTokenExpired(expirationTime)) {
          accessToken = await getAccessToken();
        }

        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
          config.withCredentials = true;
        } else {
          config.withCredentials = false;
        }

        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle token refresh on 401 errors
    api.interceptors.response.use(
      (response: any) => {
        return response;
      },
      async (error: any) => {
        if (error.name === "CanceledError") {
          return Promise.reject(error);
        }

        const originalRequest = error.config;
        const path = originalRequest?.url;
        // Check if the request URL or current page is for a public app
        const isPublic = await checkCurrentPagePrivacy(path, originalRequest?.signal);

        if (isPublic) {
          return Promise.reject(error);
        }

        // Check if the error is due to an invalid token
        if (
          error.response?.status === 401 &&
          error.response?.data?.code === "token_not_valid" &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          try {
            let accessToken = localStorage.getItem("accessToken");

            if (!accessToken) {
               return Promise.reject(error);
            }

            // Normal token handling for non-public or unknown pages
            const expirationTime = localStorage.getItem(
              "accessTokenExpiration"
            );

            if (isTokenExpired(expirationTime)) {
              accessToken = await getAccessToken();
            }

            // Update the authorization header
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            // Retry the original request with null check
            return api ? api(originalRequest) : Promise.reject(new Error("API instance is null"));
          } catch (refreshError) {
            // If refresh token is also expired, redirect to login
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return api;
  };
};

/**
 * It works like a global hooks for the application, it stores same state among different components
 */
const axiosInstance = axiosInstanceSingleton();

export default axiosInstance;
