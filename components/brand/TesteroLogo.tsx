"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TesteroIcon, TesteroIconProps } from "./TesteroIcon";

export interface TesteroLogoProps extends Omit<TesteroIconProps, "size"> {
  /** Size preset for the logo */
  size?: "sm" | "md" | "lg" | number;
  /** Whether to show the text wordmark */
  showText?: boolean;
  /** Link href (if provided, wraps in Link component) */
  href?: string;
  /** Additional CSS classes */
  className?: string;
}

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 48,
};

/**
 * Testero logo component - displays icon with optional wordmark
 * Used for navbar, auth pages, and footer
 */
export const TesteroLogo: React.FC<TesteroLogoProps> = ({
  size = "md",
  showText = true,
  href = "/",
  className,
  variant = "default",
}) => {
  const iconSize = typeof size === "number" ? size : sizeMap[size];
  const textSizeMap = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };
  const textSizeClass = typeof size === "number" ? "text-xl" : textSizeMap[size];

  const getTextColor = () => {
    switch (variant) {
      case "monochrome":
        return "text-foreground";
      case "inverse":
        return "text-white";
      default:
        return "text-foreground";
    }
  };

  const content = (
    <div className={cn("flex items-center gap-2", className)}>
      <TesteroIcon size={iconSize} variant={variant} />
      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight",
            textSizeClass,
            getTextColor()
          )}
        >
          Testero
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label="Testero Home" className="inline-block">
        {content}
      </Link>
    );
  }

  return content;
};

TesteroLogo.displayName = "TesteroLogo";
