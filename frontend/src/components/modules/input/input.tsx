"use client";

import React, { useState } from "react";
import { Controller } from "react-hook-form";
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { InputProps } from "./input.types";

export default function Input({
  type,
  placeholder,
  control,
  name,
  defaultValue = "",
  rules = {},
  style,
  error,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      rules={rules}
      render={({ field }) => (
        <div className="w-full my-newclass">
          <div className="relative">
            <input
              type={type === "password" ? (!showPassword ? "password" : "text") : type}
              placeholder={placeholder}
              {...field}
              style={style}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {type === "password" && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
              </button>
            )}
          </div>
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>
      )}
    />
  );
}
