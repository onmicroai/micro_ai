"use client";

import { ButtonProps } from "@/types";
import { buttonSizes, buttonTypes } from "@/constants";

export default function Button({
  type,
  size,
  text,
  style,
  onClick,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      style={style}
      className={`
        px-4 py-2 rounded-lg font-medium transition-colors
        ${type === buttonTypes.primary 
          ? 'bg-primary text-primary-foreground hover:bg-primary-600' 
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
        }
        ${size === buttonSizes.large ? 'text-lg px-6 py-3' : 'text-base'}
      `}
    >
      {text}
    </button>
  );
}
