// microai-frontend\components\layout\navbar\authButtons.tsx
"use client";
import Button from "@/components/modules/button/button";
import { buttonTypes } from "@/constants";
import { useRouter } from "next/navigation";

export default function AuthButtons() {
  const router = useRouter();

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