import React, { useId } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";

export interface TextInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size" | "children"
  > {
  label: string;
  hint?: string;
  error?: string;
  info?: string;
  containerClassName?: string;
}

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      id,
      name,
      label,
      hint,
      error,
      info,
      required,
      disabled,
      readOnly,
      className,
      containerClassName,
      ...props
    },
    ref
  ) => {
  const fallbackId = useId();
  const inputId = id ?? name ?? `input-${fallbackId}`;
  const hintId = `${inputId}-hint`;
  const hasError = Boolean(error);
  const hintText = hasError ? error : hint;

  return (
    <div className={cn("flex w-full flex-col items-start gap-1.5", containerClassName)}>
      <div className="flex w-full items-baseline gap-2">
        <label
          htmlFor={inputId}
          className={cn(
            "text-sm font-medium text-gray-900",
            disabled && "text-gray-500"
          )}
        >
          {label}
        </label>
        {required && <span className="text-sm font-medium text-red-500">*</span>}
        {info && (
          <span
            className="inline-flex items-center text-gray-400"
            title={info}
            aria-label={info}
          >
            <InformationCircleIcon className="h-4 w-4" />
          </span>
        )}
      </div>

      <input
        id={inputId}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={hintId}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          "w-full rounded-md border px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400",
          "bg-white border-gray-300 hover:border-gray-400 focus:border-primary-600 focus:outline-none",
          "transition-colors",
          hasError && "border-red-500 hover:border-red-500 focus:border-red-500",
          disabled && "bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-400 cursor-not-allowed",
          readOnly && !disabled && "bg-gray-50",
          className
        )}
        ref={ref}
        {...props}
      />

      <p
        id={hintId}
        className={cn(
          "min-h-[1rem] text-xs",
          hasError && "text-red-600",
          !hasError && !disabled && "text-gray-500",
          disabled && "text-gray-400"
        )}
      >
        {hintText ?? ""}
      </p>
    </div>
  );
}
);

TextInput.displayName = "TextInput";

export default TextInput;
