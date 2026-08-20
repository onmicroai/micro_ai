"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserManager, markSessionPresent } from "@/utils/keycloakAuth";

/**
 * PKCE redirect target Keycloak sends the browser back to after login.
 * Not under /auth/ — see the comment on redirect_uri in utils/keycloakAuth.ts
 * for why that path is reserved for Keycloak itself, not this app.
 */
export default function AuthCallbackPage() {
   const router = useRouter();
   const [error, setError] = useState<string | null>(null);
   const ranOnce = useRef(false);

   useEffect(() => {
      // Effects run twice under React StrictMode in dev; the authorization
      // code Keycloak sent is single-use, so a second call would fail.
      if (ranOnce.current) return;
      ranOnce.current = true;

      getUserManager()
         .signinRedirectCallback()
         .then((user) => {
            markSessionPresent();
            const returnTo = typeof user.state === "string" ? user.state : "/dashboard";
            router.replace(returnTo);
         })
         .catch((err) => {
            console.error("Keycloak sign-in callback failed:", err);
            setError(err instanceof Error ? err.message : "Sign-in failed");
         });
   }, [router]);

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
