import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border",
  success: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100",
  warning:
    "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100",
  destructive: "bg-destructive text-destructive-foreground",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border-transparent px-2 py-0.5 text-xs font-semibold",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
