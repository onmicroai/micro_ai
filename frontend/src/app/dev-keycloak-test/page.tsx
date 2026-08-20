"use client";

/**
 * Isolated manual test harness for the PR 8 OIDC engine — NOT part of the
 * app's real auth flow (that swap happens in PR 9). Deliberately mounts its
 * own KeycloakAuthProvider rather than relying on app/layout.tsx, so this
 * exercises the new engine without touching any existing consumer.
 * Safe to delete once PR 9 lands and there's a real page doing this.
 */
import { KeycloakAuthProvider, useKeycloakAuth } from "@/context/KeycloakAuthContext";

function Inner() {
   const { isAuthenticated, user, login, logout } = useKeycloakAuth();

   return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
         <h1>Keycloak OIDC test harness</h1>
         <p>isAuthenticated: {String(isAuthenticated)}</p>
         <p>user: {user ? user.profile.email : "null"}</p>
         <button onClick={() => login("/dev-keycloak-test")}>Login</button>
         <button onClick={() => logout()} style={{ marginLeft: 8 }}>
            Logout
         </button>
      </div>
   );
}

export default function DevKeycloakTestPage() {
   return (
      <KeycloakAuthProvider>
         <Inner />
      </KeycloakAuthProvider>
   );
}
