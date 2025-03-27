"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

import { useAuth } from "@/context/AuthContext";

export default function EmailVerificationPage({
  params,
}: {
  params: { key: string };
}) {
  const { authorizeUserWithJwt } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const verifyEmail = async (signal: AbortSignal) => {
      try {
        const response = await fetch("/api/auth/verify-email/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: params.key,
          }),
          signal,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === "success" && data.jwt) {
            await authorizeUserWithJwt(data.jwt, signal);

            toast.success(
              "Email verification successful! Redirecting to dashboard..."
            );

            setTimeout(() => {
              router.push("/dashboard");
            }, 3000);

            return;
          }
        }
        toast.error(
          "An error occurred during verification. Redirecting to registration page..."
        );

        setTimeout(() => {
          router.push("/accounts/registration");
        }, 3000);
      } catch (error: any) {
        if (error.name !== "AbortError") {
          toast.error(
            "An error occurred during verification. Redirecting to registration page...",
            {
              position: "top-center",
              autoClose: 3000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            }
          );

          // Redirect to registration page after 3 seconds
          setTimeout(() => {
            router.push("/accounts/registration");
          }, 3000);
        }
      }
    };

    verifyEmail(signal);

    return () => controller.abort();
  }, [params.key, router, authorizeUserWithJwt]);

  return (
    <div className="container max-w-lg mx-auto mt-10 px-4">
      <div className="flex flex-col items-center justify-center space-y-4">
         <DotLottieReact
            src="/img/verifying_email.lottie"
            loop
            autoplay
         />
        <p className="text-lg">Verifying your email...</p>
      </div>
    </div>
  );
}
