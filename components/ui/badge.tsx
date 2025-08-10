"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "error" | "warning" | "info";
  size?: "sm" | "md" | "lg";
  as?: React.ElementType;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", size = "md", as: Component = "div", ...props }, ref) => {
    // Variant styles using design system tokens via Tailwind classes
    const variantStyles = {
      default: "bg-neutral-100 text-neutral-700 border-neutral-200",
      success: "bg-success-light text-success-dark border-success/40",
      error: "bg-error-light text-error-dark border-error/40",
      warning: "bg-warning-light text-warning-dark border-warning/40",
      info: "bg-info-light text-info-dark border-info/40",
    };

    // Size styles
    const sizeStyles = {
      sm: "text-xs px-2 py-0.5",
      md: "text-sm px-3 py-1",
      lg: "text-base px-4 py-1.5",
    };

    return (
      <Component
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center",
          "rounded-md border font-medium",
          "transition-colors",

          // Apply variant styles
          variantStyles[variant],

          // Apply size styles
          sizeStyles[size],

          // Custom className
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
