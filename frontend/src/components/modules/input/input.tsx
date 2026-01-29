"use client";

import React from "react";
import { Controller } from "react-hook-form";
import { InputProps } from "./input.types";
import TextInput from "@/components/ui/TextInput";

export default function Input({
  type = "text",
  placeholder,
  control,
  name,
  label,
  hint,
  info,
  defaultValue = "",
  rules = {},
  disabled,
  readOnly,
  error,
}: InputProps) {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      rules={rules}
      render={({ field }) => (
        <TextInput
          {...field}
          type={type}
          placeholder={placeholder}
          label={label}
          hint={hint}
          info={info}
          disabled={disabled}
          readOnly={readOnly}
          error={error}
        />
      )}
    />
  );
}
