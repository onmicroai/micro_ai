"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Keycloak owns registration now (registrationAllowed: true in the realm —
// keycloak/realm-export.json) via its own hosted login page's "Register"
// link. There's nothing left for this app to submit a signup form to, so
// this route just forwards into the same login redirect as /accounts/login.
function RegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
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

export default function RegistrationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegistrationContent />
    </Suspense>
  );
}
