"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { BRAND_COLORS } from "./logo-colors";
import { primitive } from "@/lib/design-system/tokens/colors";

export interface TesteroIconProps {
  /** Size of the icon in pixels */
  size?: number | string;
  /** Additional CSS classes */
  className?: string;
  /** Visual variant of the icon */
  variant?: "default" | "monochrome" | "inverse";
}

/**
 * Testero icon component - displays just the checkmark icon
 * Used for favicons, small spaces, and dashboard TopBar
 */
export const TesteroIcon: React.FC<TesteroIconProps> = ({
  size = 32,
  className,
  variant = "default",
}) => {
  const sizeValue = typeof size === "number" ? `${size}px` : size;
  
  // Determine colors based on variant
  const getColors = () => {
    switch (variant) {
      case "monochrome":
        return {
          teal: "currentColor",
          navy: "currentColor",
        };
      case "inverse":
        return {
          teal: primitive.white,
          navy: primitive.white,
        };
      default:
        return {
          teal: BRAND_COLORS.teal,
          navy: BRAND_COLORS.navy,
        };
    }
  };

  const colors = getColors();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 324 299"
      width={sizeValue}
      height={sizeValue}
      className={cn("flex-shrink-0", className)}
      aria-label="Testero"
      role="img"
    >
      {/* White background (for transparency) */}
      <path
        fill={primitive.white}
        d="M 324.00 0.00 L 324.00 299.00 L 0.00 299.00 L 0.00 0.00 L 324.00 0.00 Z M 110.53 56.63 A 0.23 0.23 0.0 0 0 110.21 56.63 L 74.28 92.56 A 1.29 1.27 -38.1 0 0 74.08 94.12 Q 74.77 95.28 75.73 96.27 Q 94.55 115.70 108.88 129.55 C 126.11 146.20 136.73 157.56 152.82 173.18 Q 155.07 175.37 156.84 176.92 A 0.41 0.40 43.4 0 0 157.40 176.91 L 320.28 14.02 A 0.86 0.86 0.0 0 0 319.66 12.55 Q 278.93 13.15 249.00 12.65 Q 246.81 12.62 244.98 14.48 Q 213.64 46.22 205.68 54.18 Q 181.39 78.46 162.42 97.92 Q 160.17 100.22 157.39 102.56 A 0.72 0.71 47.1 0 1 156.42 102.52 L 110.53 56.63 Z M 223.27 13.10 L 7.14 13.10 A 0.93 0.92 -90.0 0 0 6.22 14.03 L 6.22 89.30 A 0.72 0.71 90.0 0 0 6.93 90.02 L 53.25 90.02 A 2.61 2.60 32.8 0 0 54.32 89.79 Q 56.02 89.04 57.92 87.17 Q 75.39 69.86 92.16 52.66 Q 98.57 46.09 109.37 35.66 A 1.17 1.17 0.0 0 1 111.01 35.68 L 156.47 81.13 A 0.28 0.28 0.0 0 0 156.87 81.13 L 223.75 14.25 A 0.68 0.67 22.4 0 0 223.27 13.10 Z M 196.44 285.21 A 0.31 0.31 0.0 0 0 196.75 284.90 L 196.75 160.26 A 0.31 0.31 0.0 0 0 196.22 160.04 L 157.26 198.99 A 0.31 0.31 0.0 0 1 156.82 198.99 L 118.48 160.64 A 0.31 0.31 0.0 0 0 117.95 160.86 L 117.95 284.90 A 0.31 0.31 0.0 0 0 118.26 285.21 L 196.44 285.21 Z"
      />
      {/* Teal checkmark path */}
      <path
        fill={colors.teal}
        d="M 110.53 56.63 L 156.42 102.52 A 0.72 0.71 47.1 0 0 157.39 102.56 Q 160.17 100.22 162.42 97.92 Q 181.39 78.46 205.68 54.18 Q 213.64 46.22 244.98 14.48 Q 246.81 12.62 249.00 12.65 Q 278.93 13.15 319.66 12.55 A 0.86 0.86 0.0 0 1 320.28 14.02 L 157.40 176.91 A 0.41 0.40 43.4 0 1 156.84 176.92 Q 155.07 175.37 152.82 173.18 C 136.73 157.56 126.11 146.20 108.88 129.55 Q 94.55 115.70 75.73 96.27 Q 74.77 95.28 74.08 94.12 A 1.29 1.27 -38.1 0 1 74.28 92.56 L 110.21 56.63 A 0.23 0.23 0.0 0 1 110.53 56.63 Z"
      />
      {/* Navy paths */}
      <path
        fill={colors.navy}
        d="M 223.27 13.10 A 0.68 0.67 22.4 0 1 223.75 14.25 L 156.87 81.13 A 0.28 0.28 0.0 0 1 156.47 81.13 L 111.01 35.68 A 1.17 1.17 0.0 0 0 109.37 35.66 Q 98.57 46.09 92.16 52.66 Q 75.39 69.86 57.92 87.17 Q 56.02 89.04 54.32 89.79 A 2.61 2.60 32.8 0 1 53.25 90.02 L 6.93 90.02 A 0.72 0.71 -90.0 0 1 6.22 89.30 L 6.22 14.03 A 0.93 0.92 90.0 0 1 7.14 13.10 L 223.27 13.10 Z"
      />
      <path
        fill={colors.navy}
        d="M 196.44 285.21 L 118.26 285.21 A 0.31 0.31 0.0 0 1 117.95 284.90 L 117.95 160.86 A 0.31 0.31 0.0 0 1 118.48 160.64 L 156.82 198.99 A 0.31 0.31 0.0 0 0 157.26 198.99 L 196.22 160.04 A 0.31 0.31 0.0 0 1 196.75 160.26 L 196.75 284.90 A 0.31 0.31 0.0 0 1 196.44 285.21 Z"
      />
    </svg>
  );
};

TesteroIcon.displayName = "TesteroIcon";
