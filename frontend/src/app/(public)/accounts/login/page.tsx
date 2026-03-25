"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Login from "@/components/Login";
import { useDashboardStore } from "@/app/(authenticated)/(dashboard)/dashboard/[tab]/store/dashboardStore";
import axios from "axios";

// Create a wrapper component that uses searchParams
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const cloneApp = useDashboardStore((state) => state.cloneApp);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendHint, setResendHint] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  // Move handlePendingRemix inside useEffect or wrap it in useCallback
  const handlePendingRemix = useCallback(async () => {
    const pendingRemixAppId = localStorage.getItem("pendingRemixAppId");
    if (pendingRemixAppId) {
      try {
        await cloneApp(parseInt(pendingRemixAppId));
        localStorage.removeItem("pendingRemixAppId");
      } catch (error) {
        console.error("Error handling pending remix:", error);
      }
    }
  }, [cloneApp]);

  // Only redirect if we detect user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      handlePendingRemix().then(() => {
        const nextPath = searchParams.get("next");
        router.push(nextPath || "/dashboard");
      });
    }
  }, [isAuthenticated, router, searchParams, handlePendingRemix]);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldownSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldownSeconds]);

  const handleSubmit = async (data: { email: string; password: string }) => {
    try {
      setError("");
      setInfoMessage("");
      setShowResendVerification(false);
      setResendHint("");
      await login(data.email, data.password);
      // The redirect will be handled by the useEffect above
    } catch (err: any) {
      const message = err.message || "Invalid email or password";
      setError(message);
      const lowered = String(message).toLowerCase();
      if (lowered.includes("not verified")) {
        setShowResendVerification(true);
        setResendHint("Resend verification email");
      }
    }
  };

  const handleResendVerification = async (email: string) => {
    if (!email?.trim()) {
      setError("Please enter your email address first.");
      setInfoMessage("");
      return;
    }
    if (resendCooldownSeconds > 0) {
      return;
    }
    try {
      setIsResending(true);
      setError("");

      const minLoaderMs = 700;
      const minLoaderPromise = new Promise((resolve) =>
        setTimeout(resolve, minLoaderMs)
      );
      const api = axios.create({
        baseURL: process.env.NEXT_PUBLIC_API_URL,
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      const [response] = await Promise.all([
        api.post("/api/auth/resend-verification/", { email }),
        minLoaderPromise,
      ]);
      setInfoMessage(
        response.data?.detail ||
          "If this email exists and is unverified, a new verification email has been sent."
      );
      setShowResendVerification(true);
      setResendCooldownSeconds(60);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to resend verification email.";
      setError(message);
      setInfoMessage("");
    } finally {
      setIsResending(false);
    }
  };

  // If already authenticated, don't show anything while redirecting
  if (isAuthenticated) {
    return null;
  }

  // Show login form by default
  return (
    <div className="min-h-screen bg-white">
      <Login
        onSubmit={handleSubmit}
        error={error}
        infoMessage={infoMessage}
        onResendVerification={
          showResendVerification ? handleResendVerification : undefined
        }
        resendVerificationHint={
          showResendVerification
            ? resendCooldownSeconds > 0
              ? `Resend available in ${resendCooldownSeconds}s`
              : resendHint || "Resend verification email"
            : undefined
        }
        resendDisabled={resendCooldownSeconds > 0}
        resendLoading={isResending}
      />
    </div>
  );
}

// Main page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
