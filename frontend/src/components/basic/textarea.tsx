import * as React from "react";
import { getBaseInputStyles } from "./input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={getBaseInputStyles(`min-h-[100px] ${className ?? ""}`)}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea, getBaseInputStyles };
