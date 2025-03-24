"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import HidePasswordIcon from "@/public/hidePassword.svg";
import ShowPasswordIcon from "@/public/showPassword.svg";

export default function ShowPasswordButton({
  passwordIsShown,
}: {
  passwordIsShown: (passwordShown: boolean) => void;
}) {
  const [passwordShown, setPasswordShown] = useState(false);

  useEffect(() => {
    passwordIsShown(passwordShown);
  }, [passwordShown, passwordIsShown]);

  const togglePassword = () => {
    setPasswordShown((prevState) => !prevState);
  };

  return (
    <button
      style={{ paddingRight: "1rem" }}
      onClick={togglePassword}
      type="button"
    >
      <Image
        src={passwordShown ? HidePasswordIcon : ShowPasswordIcon}
        alt="password-eye"
      />
    </button>
  );
}
