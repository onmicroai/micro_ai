"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Keycloak owns registration now (registrationAllowed: true in the realm —
// keycloak/realm-export.json) via its own hosted registration form. There's
// nothing left for this app to submit a signup form to, so this route just
// forwards straight into Keycloak's registration form (not its login form —
// see register() in KeycloakAuthContext/keycloakAuth.ts for why that needs
// a second UserManager rather than just calling login()).
function RegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const nextPath = searchParams.get("next");
      router.replace(nextPath || "/dashboard");
      return;
    }
    const nextPath = searchParams.get("next");
    register(nextPath || "/dashboard");
  }, [isAuthenticated, router, searchParams, register]);

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
