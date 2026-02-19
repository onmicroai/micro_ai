import * as React from "react";
import { cn } from "@/utils/cn";

const getBaseInputStyles = (
  className?: string,
  disabled?: boolean,
  error?: boolean
) =>
  cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    "w-full rounded-md border border-gray-300 p-3 text-gray-900 focus:border-primary-600 focus:ring-primary",
    `${disabled ? "bg-gray-50 text-gray-500" : "bg-white"}`,
    `${
      error
        ? "border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500"
        : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
    }`,
    "hover:border-black-600",
    className
  );

interface IInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  errorMessage?: string | null;
}

const Input = React.forwardRef<HTMLInputElement, IInputProps>(
  ({ className, type, error, errorMessage, ...props }, ref) => {
    return (
      <>
        <input
          type={type}
          className={getBaseInputStyles(className, props.disabled, error)}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}
      </>
    );
  }
);
Input.displayName = "Input";

export { Input, getBaseInputStyles };
