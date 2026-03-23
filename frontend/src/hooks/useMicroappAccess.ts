"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUserStore } from "@/store/userStore";
import { checkRole } from "@/utils/checkRoles";
import { checkIsPublic } from "@/utils/checkAppPrivacy";
import {
  getAccessToken,
  getAccessTokenExpiration,
} from "@/utils/tokenCookieUtils";
import isTokenExpired from "@/utils/isTokenExpired";

/**
 * run | embed — public apps allowed for everyone; private apps need owner or admin.
 * edit — builder: owner or admin only (ignores public visibility).
 * owner — owner only (e.g. single-conversation stats).
 */
export type MicroappAccessMode = "run" | "embed" | "edit" | "owner";

export interface MicroappAccessResult {
  /**
   * True while visibility/roles are resolving. For public run/embed apps, profile
   * fetch does not extend this once `isPublicApp` is known.
   */
  shellLoading: boolean;
  /** When shellLoading is false, whether this surface may be shown */
  isAuthorized: boolean;
  /** run | embed: app is publicly visible */
  isPublicApp: boolean;
}

function rolesAllowAccess(mode: MicroappAccessMode, roles: string[]): boolean {
  if (mode === "owner") {
    return roles.includes("owner");
  }
  return roles.includes("owner") || roles.includes("admin");
}

export function useMicroappAccess(
  hashId: string,
  mode: MicroappAccessMode
): MicroappAccessResult {
  const { user, isLoading: userIsLoading } = useUserStore();
  const userId = user?.id ?? null;

  const isProfilePending = useMemo(() => {
    if (typeof window === "undefined") {
      return userIsLoading;
    }
    const hasValidAccessToken =
      !!getAccessToken() && !isTokenExpired(getAccessTokenExpiration());
    return userIsLoading || (hasValidAccessToken && user === null);
  }, [user, userIsLoading]);

  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isPublicApp, setIsPublicApp] = useState(false);

  const seqRef = useRef(0);

  /**
   * Once a run/embed app is known to be public, guests do not need a resolved
   * profile — otherwise we keep them on the shell while getUser() runs and they
   * never match the old layout branches that expected isAuthorized + routing.
   */
  const shellLoading = authLoading || (isProfilePending && !isPublicApp);

  useEffect(() => {
    const seq = ++seqRef.current;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const finish = (next: {
      authLoading: boolean;
      isAuthorized: boolean;
      isPublicApp: boolean;
    }) => {
      if (seq !== seqRef.current) {
        return;
      }
      setAuthLoading(next.authLoading);
      setIsAuthorized(next.isAuthorized);
      setIsPublicApp(next.isPublicApp);
    };

    const run = async () => {
      if (seq !== seqRef.current) {
        return;
      }
      setAuthLoading(true);

      try {
        if (mode === "edit" || mode === "owner") {
          if (userId === null) {
            if (isProfilePending) {
              finish({
                authLoading: true,
                isAuthorized: false,
                isPublicApp: false,
              });
              return;
            }
            finish({
              authLoading: false,
              isAuthorized: false,
              isPublicApp: false,
            });
            return;
          }

          const { roles, error } = await checkRole(hashId, userId, signal);
          if (seq !== seqRef.current) {
            return;
          }

          const allowed = !error && rolesAllowAccess(mode, roles);
          finish({
            authLoading: false,
            isAuthorized: allowed,
            isPublicApp: false,
          });
          return;
        }

        const embedOrigin =
          mode === "embed" && typeof window !== "undefined"
            ? document.referrer || ""
            : undefined;

        const { isPublic, embedAllowed, error } = await checkIsPublic(
          hashId,
          signal,
          embedOrigin
        );
        if (seq !== seqRef.current) {
          return;
        }

        if (error) {
          const errorName = error.name;
          if (errorName === "AbortError" || errorName === "CanceledError") {
            return;
          }
          console.error("Error checking public status:", error);
          finish({
            authLoading: false,
            isAuthorized: false,
            isPublicApp: false,
          });
          return;
        }

        if (mode === "embed" && embedAllowed === true) {
          finish({
            authLoading: false,
            isAuthorized: true,
            isPublicApp: true,
          });
          return;
        }

        // For embed mode, deny when embed is not allowed (domain restriction applies to everyone, including owner)
        if (mode === "embed") {
          finish({
            authLoading: false,
            isAuthorized: false,
            isPublicApp: false,
          });
          return;
        }

        if (isPublic) {
          finish({
            authLoading: false,
            isAuthorized: true,
            isPublicApp: true,
          });
          return;
        }

        if (userId === null) {
          if (isProfilePending) {
            finish({
              authLoading: true,
              isAuthorized: false,
              isPublicApp: false,
            });
            return;
          }
          finish({
            authLoading: false,
            isAuthorized: false,
            isPublicApp: false,
          });
          return;
        }

        const { roles, error: roleError } = await checkRole(
          hashId,
          userId,
          signal
        );
        if (seq !== seqRef.current) {
          return;
        }

        const allowed = !roleError && rolesAllowAccess("edit", roles);
        finish({
          authLoading: false,
          isAuthorized: allowed,
          isPublicApp: false,
        });
      } catch (e: unknown) {
        const errorName =
          e && typeof e === "object" && "name" in e
            ? String((e as { name?: string }).name)
            : "";
        if (
          errorName &&
          errorName !== "AbortError" &&
          errorName !== "CanceledError"
        ) {
          console.error("Microapp access check failed:", e);
        }
        if (seq !== seqRef.current) {
          return;
        }
        if (errorName === "AbortError" || errorName === "CanceledError") {
          return;
        }
        finish({
          authLoading: false,
          isAuthorized: false,
          isPublicApp: false,
        });
      }
    };

    void run();

    return () => {
      abortController.abort();
    };
  }, [hashId, userId, mode, isProfilePending]);

  return { shellLoading, isAuthorized, isPublicApp };
}
