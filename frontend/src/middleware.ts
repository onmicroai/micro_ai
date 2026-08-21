import { NextRequest, NextResponse } from "next/server";

// Deliberately NOT imported from utils/keycloakAuth.ts (which exports this
// same name) — that module pulls in oidc-client-ts, which isn't Edge
// Runtime-safe. The old code hardcoded "access_token"/"refresh_token" here
// rather than importing from tokenCookieUtils.ts for the same reason; kept
// that pattern. Must stay in sync with SESSION_PRESENT_COOKIE there by hand.
const SESSION_PRESENT_COOKIE = "kc_session_present";

export function middleware(request: NextRequest) {
  // Presence-only, same as the old access_token/refresh_token check — this
  // Edge Runtime can't read localStorage (where the actual Keycloak tokens
  // live), so it never verified the JWT either, before or after this swap.
  // See utils/keycloakAuth.ts's markSessionPresent/clearSessionPresent for
  // where this cookie is actually set/cleared.
  const hasSession = !!request.cookies.get(SESSION_PRESENT_COOKIE)?.value;
  const pathname = request.nextUrl.pathname.toLowerCase();

  // Edit URLs are often shared by mistake; guests should see the public app, not login.
  if (!hasSession) {
    const editPathMatch = pathname.match(/^\/app\/edit\/([^/]+)\/?$/);
    if (editPathMatch) {
      const id = editPathMatch[1];
      return NextResponse.redirect(new URL(`/app/${id}`, request.url));
    }
  }

  // Define protected and public paths
  const protectedPaths = ["dashboard", "app/edit", "settings"];
  const authPaths = ["/accounts/login", "/accounts/registration", "/accounts/password/reset"];
  const publicPaths = ["public"];

  // If this is a post-logout redirect, don't try to authenticate

  // Check if the current path is protected
  const isProtectedPath = protectedPaths.some(path => pathname.includes(path)) &&
    !publicPaths.some(path => pathname.includes(path));

  // Check if the current path is an auth path
  const isAuthPath = authPaths.some(path => pathname.toLowerCase() === path.toLowerCase());

  // Redirect to login if trying to access protected path without a session
  if (isProtectedPath && !hasSession) {
    const url = new URL("/accounts/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if accessing auth paths while logged in
  if (isAuthPath && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Handle legacy login paths
  if (pathname.includes("login") && !pathname.includes("accounts/login")) {
    return NextResponse.redirect(new URL("/accounts/login", request.url));
  }

  if (pathname.includes("registration") && !pathname.includes("accounts/registration")) {
    return NextResponse.redirect(new URL("/accounts/registration", request.url));
  }

  if (pathname.includes("forgot-password") && !pathname.includes("accounts/password/reset")) {
    return NextResponse.redirect(new URL("/accounts/password/reset", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
