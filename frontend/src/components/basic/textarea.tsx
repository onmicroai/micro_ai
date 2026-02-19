import * as React from "react";
import { getBaseInputStyles } from "./input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.InputHTMLAttributes<HTMLTextAreaElement>
>(({ className, type: _type, ...props }, ref) => {
  return (
    <textarea
      className={getBaseInputStyles(`${className} min-h-[100px]`)}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea, getBaseInputStyles };
