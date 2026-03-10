// microai-frontend\components\layout\navbar\authButtons.tsx
"use client";
import Button from "@/components/modules/button/button";
import { buttonTypes } from "@/constants";
import { useRouter } from "next/navigation";

interface AuthButtonsProps {
  variant?: "light";
}

export default function AuthButtons({ variant }: AuthButtonsProps) {
  const router = useRouter();

  if (variant === "light") {
    return (
      <>
        <button
          type="button"
          onClick={() => router.push("/accounts/login")}
          className="px-4 py-2 rounded-lg font-medium text-base border border-white/80 text-white hover:bg-white/10 transition-colors"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => router.push("/accounts/registration")}
          className="px-4 py-2 rounded-lg font-medium text-base bg-white text-slate-900 hover:bg-white/90 transition-colors"
        >
          Sign Up
        </button>
      </>
    );
  }

  return (
    <>
      <Button
        type={buttonTypes.secondary}
        text="Sign In"
        onClick={() => router.push("/accounts/login")}
      />
      <Button
        type={buttonTypes.primary}
        text="Sign Up"
        onClick={() => router.push("/accounts/registration")}
      />
    </>
  );
}