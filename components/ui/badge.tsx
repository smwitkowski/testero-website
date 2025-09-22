import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        solid: "shadow-sm",
        soft: "ring-1 ring-inset",
        outline: "bg-background ring-1 ring-inset",
        ghost: "bg-transparent",
      },
      tone: {
        default: "text-foreground",
        accent: "text-accent",
        success: "text-success",
        warning: "text-warning",
        danger: "text-error",
        neutral: "text-muted-foreground",
        info: "text-info",
      },
      size: {
        sm: "h-6 px-2 text-xs gap-1",
        md: "h-7 px-2.5 text-sm gap-1.5",
      },
    },
    compoundVariants: [
      {
        variant: "solid",
        tone: "default",
        class: "bg-foreground text-background",
      },
      {
        variant: "solid",
        tone: "accent",
        class: "bg-accent text-accent-foreground",
      },
      {
        variant: "solid",
        tone: "success",
        class: "bg-success text-background",
      },
      {
        variant: "solid",
        tone: "warning",
        class: "bg-warning text-background",
      },
      {
        variant: "solid",
        tone: "danger",
        class: "bg-error text-background",
      },
      {
        variant: "solid",
        tone: "neutral",
        class: "bg-muted text-foreground",
      },
      {
        variant: "solid",
        tone: "info",
        class: "bg-info text-background",
      },
      {
        variant: "soft",
        tone: "default",
        class: "bg-muted text-foreground ring-border/60",
      },
      {
        variant: "soft",
        tone: "accent",
        class: "bg-accent/10 text-accent ring-accent/20",
      },
      {
        variant: "soft",
        tone: "success",
        class: "bg-success/10 text-success ring-success/20",
      },
      {
        variant: "soft",
        tone: "warning",
        class: "bg-warning/15 text-warning-dark ring-warning/30",
      },
      {
        variant: "soft",
        tone: "danger",
        class: "bg-error/10 text-error ring-error/20",
      },
      {
        variant: "soft",
        tone: "neutral",
        class: "bg-muted/70 text-muted-foreground ring-border/40",
      },
      {
        variant: "soft",
        tone: "info",
        class: "bg-info/10 text-info ring-info/20",
      },
      {
        variant: "outline",
        tone: "default",
        class: "text-foreground ring-border/70",
      },
      {
        variant: "outline",
        tone: "accent",
        class: "text-accent ring-accent/40",
      },
      {
        variant: "outline",
        tone: "success",
        class: "text-success ring-success/35",
      },
      {
        variant: "outline",
        tone: "warning",
        class: "text-warning-dark ring-warning/40",
      },
      {
        variant: "outline",
        tone: "danger",
        class: "text-error ring-error/40",
      },
      {
        variant: "outline",
        tone: "neutral",
        class: "text-muted-foreground ring-border/50",
      },
      {
        variant: "outline",
        tone: "info",
        class: "text-info ring-info/35",
      },
      {
        variant: "ghost",
        tone: "default",
        class: "hover:bg-muted/70",
      },
      {
        variant: "ghost",
        tone: "accent",
        class: "text-accent hover:bg-accent/10",
      },
      {
        variant: "ghost",
        tone: "success",
        class: "text-success hover:bg-success/10",
      },
      {
        variant: "ghost",
        tone: "warning",
        class: "text-warning-dark hover:bg-warning/10",
      },
      {
        variant: "ghost",
        tone: "danger",
        class: "text-error hover:bg-error/10",
      },
      {
        variant: "ghost",
        tone: "neutral",
        class: "text-muted-foreground hover:bg-muted/60",
      },
      {
        variant: "ghost",
        tone: "info",
        class: "text-info hover:bg-info/10",
      },
    ],
    defaultVariants: {
      variant: "soft",
      tone: "default",
      size: "md",
    },
  }
)

const badgeIconVariants = cva("flex items-center justify-center shrink-0", {
  variants: {
    size: {
      sm: "h-3.5 w-3.5",
      md: "h-4 w-4",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    icon?: React.ReactNode
    asChild?: boolean
  }

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, tone, size, icon, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "span"

    return (
      <Comp
        ref={ref}
        data-slot="badge"
        className={cn(badgeVariants({ variant, tone, size }), className)}
        {...props}
      >
        {icon ? (
          <span aria-hidden className={badgeIconVariants({ size })}>
            {icon}
          </span>
        ) : null}
        <span className="truncate">{children}</span>
      </Comp>
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
export default Badge
