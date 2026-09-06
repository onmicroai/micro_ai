/**
 * It currently works only on client, because it reads the Keycloak session
 * from localStorage (utils/keycloakAuth.ts).
 */
"use client";

import axios, { AxiosInstance } from "axios";
import {
  checkCurrentPagePrivacy,
  forceLogout,
  getAuthHeadersForFetch,
  refreshAccessToken,
} from "./accessTokenSession";

const axiosInstanceSingleton = (): (() => AxiosInstance) => {
  let api: AxiosInstance | null = null;

  return () => {
    if (api !== null) {
      return api;
    }

    api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    api.interceptors.request.use(
      async (config: any) => {
        const path = window.location.pathname;
        const { headers: authHeaders } = await getAuthHeadersForFetch(
          path,
          config.signal
        );

        if (authHeaders.Authorization) {
          config.headers.Authorization = authHeaders.Authorization;
        }
        config.withCredentials = true;

        return config;
      },
      async (error: any) => {
        if (error?.response?.status == 401) {
          const isPublic = await checkCurrentPagePrivacy(
            typeof window !== "undefined" ? window.location.pathname : undefined
          );
          forceLogout(error, isPublic);
        }

        return Promise.reject(error);
      }
    );

    api.interceptors.response.use(
      (response: any) => {
        return response;
      },
      async (error: any) => {
        if (error.name === "CanceledError") {
          return Promise.reject(error);
        }

        const originalRequest = error.config;
        const path = window.location.pathname;
        const isPublic = await checkCurrentPagePrivacy(
          path,
          originalRequest?.signal
        );

        if (error.response?.status === 401) {
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            try {
              const accessToken = await refreshAccessToken();
              if (!accessToken) {
                forceLogout(error, isPublic);
                return Promise.reject(error);
              }

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;

              return api
                ? api(originalRequest)
                : Promise.reject(new Error("API instance is null"));
            } catch (refreshError) {
              forceLogout(refreshError, isPublic);
              return Promise.reject(refreshError);
            }
          }

          forceLogout(error, isPublic);
        }

        return Promise.reject(error);
      }
    );

    return api;
  };
};

const axiosInstance = axiosInstanceSingleton();

export default axiosInstance;
