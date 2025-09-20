import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
// Note: Design system button variants available for future use

import { cn } from "@/lib/utils"

// Convert design system button variants to CVA format
const buttonVariants = cva(
  // Base styles from design system
  "inline-flex items-center justify-center rounded-lg font-semibold text-decoration-none transition-all cursor-pointer border-none outline-none select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // Primary variant using design system tokens
        default:
          "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 hover:scale-105 active:scale-98 shadow-lg hover:shadow-xl",
        // Secondary variant
        secondary:
          "bg-white text-slate-800 border border-white hover:bg-slate-50 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0",
        // Ghost variant for transparent buttons
        ghost:
          "bg-transparent text-white border border-white/40 hover:bg-white/20 shadow-sm hover:shadow-md",
        // Outline variant
        outline:
          "bg-transparent text-slate-800 border border-slate-300 hover:bg-slate-50",
        // Destructive variant
        destructive:
          "bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl",
        // Link variant  
        link: "text-orange-500 underline-offset-4 hover:underline bg-transparent border-none shadow-none",
      },
      size: {
        // Size variants using design system spacing
        sm: "h-9 px-3 py-2 text-sm gap-1.5",
        default: "h-11 px-4 py-3 text-base gap-2", 
        lg: "h-13 px-6 py-4 text-lg gap-2",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
