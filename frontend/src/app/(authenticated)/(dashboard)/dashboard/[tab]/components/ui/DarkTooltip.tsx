"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/utils/cn";

/** Dark tooltip style: charcoal background, white text, bottom pointer - for dashboard action buttons */
const DarkTooltipProvider = TooltipPrimitive.Provider;

const DarkTooltip = TooltipPrimitive.Root;

const DarkTooltipTrigger = TooltipPrimitive.Trigger;

const DarkTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, side = "top", ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      side={side}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-gray-800 px-3 py-2 text-xs text-white shadow-lg",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-gray-800" width={10} height={5} />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
DarkTooltipContent.displayName = "DarkTooltipContent";

export {
  DarkTooltip,
  DarkTooltipTrigger,
  DarkTooltipContent,
  DarkTooltipProvider,
};
