"use client";

import { useEffect } from "react";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

import { useAuth } from "@/context/AuthContext";

// Keycloak sends and verifies its own confirmation emails now
// (verifyEmail: true — keycloak/realm-export.json), pointing at a
// Keycloak-hosted confirmation URL, never this route. This page only still
// exists for stray links from emails Django sent before the Keycloak
// cutover — there is no live way to land here going forward, since
// /accounts/registration no longer talks to Django at all.
export default function EmailVerificationPage() {
  const { login } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      login();
    }, 3000);
    return () => clearTimeout(timer);
  }, [login]);

  return (
    <div className="container max-w-lg mx-auto mt-10 px-4">
      <div className="flex flex-col items-center justify-center space-y-4">
        <DotLottieReact src="/img/success_animated.json" loop autoplay />
        <p className="text-lg">
          Email verification is now handled automatically when you sign in — redirecting you to sign in…
        </p>
      </div>
    </div>
  );
}
