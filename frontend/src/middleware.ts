import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;
  const pathname = request.nextUrl.pathname.toLowerCase();
  

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

  // Redirect to login if trying to access protected path without token
  if (isProtectedPath && !refreshToken) {
    const url = new URL("/accounts/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if accessing auth paths while logged in
  if (isAuthPath && refreshToken) {
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
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(png|jpg|jpeg|svg|ico)$).*)"],
};
