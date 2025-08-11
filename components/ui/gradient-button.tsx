"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "hero" | "cta" | "badge" | "primary" | "secondary";
  size?: "sm" | "md" | "lg" | "xl";
  href?: string;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  (
    {
      className,
      variant = "hero",
      size = "md",
      href,
      loading = false,
      fullWidth = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    // Variant styles using design system tokens via Tailwind classes
    const variantStyles = {
      hero: "bg-gradient-hero text-white hover:shadow-lg",
      cta: "bg-gradient-cta text-white hover:shadow-lg",
      badge: "bg-gradient-badge text-white hover:shadow-lg",
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      secondary: "bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50",
    };

    // Size styles
    const sizeStyles = {
      sm: "text-sm px-4 py-2",
      md: "text-base px-6 py-3",
      lg: "text-lg px-8 py-4",
      xl: "text-xl px-10 py-5",
    };

    // Gap for icons based on size
    const gapStyles = {
      sm: "gap-2",
      md: "gap-3",
      lg: "gap-3",
      xl: "gap-4",
    };

    // Loading spinner component
    const LoadingSpinner = () => (
      <svg
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    const buttonClasses = cn(
      // Base styles
      "inline-flex items-center justify-center",
      "rounded-lg font-semibold",
      "transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",

      // Apply variant styles
      variantStyles[variant],

      // Apply size styles
      sizeStyles[size],

      // Apply gap for icons
      (leftIcon || rightIcon) && gapStyles[size],

      // Full width
      fullWidth && "w-full",

      // Disabled/loading states
      (disabled || loading) && [
        disabled && !loading && "opacity-50 cursor-not-allowed",
        loading && "opacity-75 cursor-wait",
      ],

      // Custom className
      className
    );

    const buttonContent = (
      <>
        {loading && <LoadingSpinner />}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </>
    );

    // Render as Link if href is provided
    if (href && !disabled && !loading) {
      return (
        <Link href={href} className={buttonClasses}>
          {buttonContent}
        </Link>
      );
    }

    // Render as button
    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled || loading}
        onClick={onClick}
        aria-disabled={disabled || loading}
        {...props}
      >
        {buttonContent}
      </button>
    );
  }
);

GradientButton.displayName = "GradientButton";
