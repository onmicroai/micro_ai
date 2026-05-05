import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary-600",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary-600",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive-600",
        outline: "text-foreground",
        success:
          "border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        warning:
          "border-transparent bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        danger:
          "border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        muted:
          "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        neutral: "border-transparent bg-secondary-grey-100 text-gray-700",
        surface:
          "border-gray-200/80 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200",
      },
      size: {
        sm: "rounded-md px-2.5 py-0.5 text-xs",
        default: "rounded-full px-2.5 py-0.5 text-xs",
        md: "rounded-full px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
