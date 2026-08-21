"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Password reset is Keycloak's job now — its hosted login page has its own
// "Forgot Password?" link. This route no longer posts to Django's
// /api/auth/password/reset/ (that endpoint still exists for now, but new
// reset requests should go through Keycloak, which actually owns the
// credential).
export default function PasswordResetPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
      return;
    }
    login();
  }, [isAuthenticated, router, login]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-gray-600">Redirecting you to sign in…</p>
    </div>
  );
}
