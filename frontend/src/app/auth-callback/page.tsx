"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserManager, markSessionPresent } from "@/utils/keycloakAuth";
import { useDashboardStore } from "@/app/(authenticated)/(dashboard)/dashboard/[tab]/store/dashboardStore";

/**
 * PKCE redirect target Keycloak sends the browser back to after login.
 * Not under /auth/ — see the comment on redirect_uri in utils/keycloakAuth.ts
 * for why that path is reserved for Keycloak itself, not this app.
 */
export default function AuthCallbackPage() {
   const router = useRouter();
   const cloneApp = useDashboardStore((state) => state.cloneApp);
   const [error, setError] = useState<string | null>(null);
   const ranOnce = useRef(false);

   useEffect(() => {
      // Effects run twice under React StrictMode in dev; the authorization
      // code Keycloak sent is single-use, so a second call would fail.
      if (ranOnce.current) return;
      ranOnce.current = true;

      getUserManager()
         .signinRedirectCallback()
         .then(async (user) => {
            markSessionPresent();

            // Continuation of RemixBanner.tsx's "remix this app, but you're
            // not logged in" flow — it stashes the app id in localStorage
            // (survives the full-page redirect through Keycloak) before
            // sending the user to /accounts/login. This used to run inside
            // that login page itself, back when login was an in-page XHR
            // rather than a redirect away and back.
            const pendingRemixAppId = localStorage.getItem("pendingRemixAppId");
            if (pendingRemixAppId) {
               try {
                  await cloneApp(parseInt(pendingRemixAppId));
               } catch (err) {
                  console.error("Error handling pending remix:", err);
               } finally {
                  localStorage.removeItem("pendingRemixAppId");
               }
            }

            const returnTo = typeof user.state === "string" ? user.state : "/dashboard";
            router.replace(returnTo);
         })
         .catch((err) => {
            console.error("Keycloak sign-in callback failed:", err);
            setError(err instanceof Error ? err.message : "Sign-in failed");
         });
   }, [router, cloneApp]);

   if (error) {
      return (
         <div>
            <p>Sign-in failed: {error}</p>
         </div>
      );
   }

   return (
      <div>
         <p>Signing you in…</p>
      </div>
   );
}
