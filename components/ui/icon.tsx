import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** The Lucide icon component to render */
  icon: LucideIcon
  /** Size preset or custom pixel value */
  size?: "sm" | "md" | "lg" | "xl" | number
  /** Whether this icon is decorative (adds aria-hidden) */
  decorative?: boolean
  /** Additional className for styling */
  className?: string
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
}

/**
 * Brand-consistent icon wrapper component
 * Standardizes Lucide icon usage with consistent sizing, strokeWidth=2, and accessibility defaults
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: IconComponent, size = "md", decorative = true, className, ...props }, ref) => {
    const sizeValue = typeof size === "number" ? size : sizeMap[size]

    return (
      <IconComponent
        ref={ref}
        size={sizeValue}
        strokeWidth={2}
        className={cn("shrink-0", className)}
        aria-hidden={decorative ? "true" : undefined}
        {...props}
      />
    )
  }
)
Icon.displayName = "Icon"

