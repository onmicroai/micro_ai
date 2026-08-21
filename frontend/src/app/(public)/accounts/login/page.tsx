"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Keycloak owns the login form now — this page's only job is to kick off
// the PKCE redirect and preserve `next` as the post-login return path
// (read back in app/auth-callback/page.tsx via user.state).
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    // middleware.ts already bounces an authenticated visit to /accounts/login
    // away before this ever renders — this is only a fallback for the rare
    // case where its cookie check and the real Keycloak session disagree.
    if (isAuthenticated) {
      const nextPath = searchParams.get("next");
      router.replace(nextPath || "/dashboard");
      return;
    }
    const nextPath = searchParams.get("next");
    login(nextPath || "/dashboard");
  }, [isAuthenticated, router, searchParams, login]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-gray-600">Redirecting you to sign in…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
