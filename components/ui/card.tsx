import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
// Note: Design system card variants available for future use

import { cn } from "@/lib/utils"

// Convert design system card variants to CVA format
const cardVariants = cva(
  // Base card styles from design system
  "flex flex-col relative rounded-xl transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5",
        elevated:
          "bg-white border border-slate-100 shadow-lg rounded-2xl hover:shadow-xl hover:-translate-y-1",
        glass:
          "bg-white/20 border border-white/30 backdrop-blur-sm shadow-sm rounded-2xl hover:shadow-md hover:-translate-y-0.5",
      },
      size: {
        sm: "p-4 gap-4",
        default: "p-6 gap-6", 
        lg: "p-8 gap-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Card({ 
  className, 
  variant,
  size,
  ...props 
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-2 mb-4",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-lg font-semibold leading-none text-slate-800",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        "text-sm font-normal leading-relaxed text-slate-600",
        className
      )}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "flex items-center justify-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex-1", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center justify-between mt-4 pt-4 border-t border-slate-200", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
