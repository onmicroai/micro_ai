"use client";

/**
 * Thin re-export shim over KeycloakAuthContext, kept at this import path
 * (`@/context/AuthContext`) so consumers that only ever used
 * isAuthenticated/logout — the majority of them — needed zero changes for
 * the Keycloak cutover. The handful of consumers that used to call
 * login(email, password)/register(email, password)/authorizeUserWithJwt
 * (accounts/login, accounts/registration, accounts/confirm-email) were
 * rewritten directly against useKeycloakAuth, since those calls have no
 * Keycloak equivalent — there's nothing left for this app to submit
 * credentials to, Keycloak owns the whole login/registration/verification
 * surface now.
 */
export { KeycloakAuthProvider as AuthProvider, useKeycloakAuth as useAuth } from "./KeycloakAuthContext";
