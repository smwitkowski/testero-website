import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "relative flex flex-col rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "hover:-translate-y-0.5 hover:shadow-lg",
        elevated:
          "rounded-2xl border-border/40 shadow-lg hover:-translate-y-1 hover:shadow-xl",
        glass:
          "rounded-2xl border-white/30 bg-white/20 backdrop-blur-sm hover:-translate-y-0.5 hover:shadow-md",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
      },
      compact: {
        false: "",
        true: "",
      },
      inset: {
        none: "",
        content: "",
        all: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      compact: false,
      inset: "none",
    },
  }
)

type CardSize = NonNullable<VariantProps<typeof cardVariants>["size"]>
type CardInset = NonNullable<VariantProps<typeof cardVariants>["inset"]>

type CardContextValue = {
  size: CardSize
  compact: boolean
  inset: CardInset
}

const defaultContext: CardContextValue = {
  size: "md",
  compact: false,
  inset: "none",
}

const CardContext = React.createContext<CardContextValue>(defaultContext)

function useCardContext() {
  return React.useContext(CardContext)
}

const horizontalPadding: Record<CardSize, string> = {
  sm: "px-card-x-sm",
  md: "px-card-x-md md:px-card-x-lg", // Responsive: 16px mobile, 24px desktop
  lg: "px-card-x-lg",
}

const verticalPadding: Record<CardSize, string> = {
  sm: "py-card-y-sm",
  md: "py-card-y-md md:py-card-y-lg", // Responsive: 16px mobile, 24px desktop
  lg: "py-card-y-lg",
}

const compactVerticalPadding: Record<CardSize, string> = {
  sm: "py-card-y-sm",
  md: "py-card-y-sm",
  lg: "py-card-y-md",
}

const gapSpacing: Record<CardSize, string> = {
  sm: "gap-card-sm",
  md: "gap-card-md",
  lg: "gap-card-lg",
}

const compactGapSpacing: Record<CardSize, string> = {
  sm: "gap-card-sm",
  md: "gap-card-sm",
  lg: "gap-card-md",
}

const sectionGapSpacing: Record<CardSize, string> = {
  sm: "gap-card-sm",
  md: "gap-card-md",
  lg: "gap-card-lg",
}

const footerPaddingTop: Record<CardSize, { regular: string; compact: string }> = {
  sm: { regular: "pt-card-y-sm", compact: "pt-card-y-sm" },
  md: { regular: "pt-card-y-md", compact: "pt-card-y-sm" },
  lg: { regular: "pt-card-y-lg", compact: "pt-card-y-md" },
}

const actionGapSpacing: Record<CardSize, string> = {
  sm: "gap-card-sm",
  md: "gap-card-md",
  lg: "gap-card-lg",
}

const horizontalInsetSpacing: Record<CardSize, { negative: string; padding: string }> = {
  sm: { negative: "-mx-card-x-sm", padding: "px-card-x-sm" },
  md: { negative: "-mx-card-x-md", padding: "px-card-x-md" },
  lg: { negative: "-mx-card-x-lg", padding: "px-card-x-lg" },
}

const disallowedSpacingPattern = /\b(p[trblxy]?|px|py|gap|space-[xy])(-|\[)/

export type CardProps = React.ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof cardVariants> & {
    allowInternalSpacingOverride?: boolean
  }

const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    className,
    variant,
    size: sizeProp = "md",
    compact: compactProp = false,
    inset: insetProp = "none",
    allowInternalSpacingOverride = false,
    ...props
  },
  ref
) {
  const size = sizeProp as CardSize
  const compact = Boolean(compactProp)
  const inset = insetProp as CardInset

  if (!allowInternalSpacingOverride && typeof className === "string" && disallowedSpacingPattern.test(className)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Card]: Avoid applying padding or gap utilities via className. Use size/compact props or explicitly set allowInternalSpacingOverride."
      )
    }
  }

  const spacingClasses = cn(
    horizontalPadding[size],
    compact ? compactVerticalPadding[size] : verticalPadding[size],
    compact ? compactGapSpacing[size] : gapSpacing[size]
  )

  const contextValue = React.useMemo<CardContextValue>(
    () => ({ size, compact, inset }),
    [size, compact, inset]
  )

  return (
    <CardContext.Provider value={contextValue}>
      <div
        ref={ref}
        data-slot="card"
        data-card-size={size}
        data-card-compact={compact ? "true" : undefined}
        data-card-inset={inset}
        className={cn(cardVariants({ variant, size, compact, inset }), spacingClasses, className)}
        {...props}
      />
    </CardContext.Provider>
  )
})

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardHeader({ className, ...props }, ref) {
    const { size, compact, inset } = useCardContext()
    const insetClasses =
      inset === "all"
        ? [horizontalInsetSpacing[size].negative, horizontalInsetSpacing[size].padding]
        : []
    const headerGap = compact ? compactGapSpacing[size] : sectionGapSpacing[size]

    return (
      <div
        ref={ref}
        data-slot="card-header"
        className={cn(
          "flex flex-col",
          headerGap,
          insetClasses,
          className
        )}
        {...props}
      />
    )
  }
)

const CardTitle = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="card-title"
        className={cn("text-lg font-semibold leading-tight text-foreground", className)}
        {...props}
      />
    )
  }
)

const CardDescription = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardDescription({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="card-description"
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      />
    )
  }
)

const CardAction = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardAction({ className, ...props }, ref) {
    const { size, compact } = useCardContext()
    const gap = compact ? compactGapSpacing[size] : actionGapSpacing[size]
    return (
      <div
        ref={ref}
        data-slot="card-action"
        className={cn("flex items-center justify-end", gap, className)}
        {...props}
      />
    )
  }
)

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardContent({ className, ...props }, ref) {
    const { size, compact, inset } = useCardContext()
    const insetClasses =
      inset === "content" || inset === "all"
        ? [horizontalInsetSpacing[size].negative, horizontalInsetSpacing[size].padding]
        : []

    return (
      <div
        ref={ref}
        data-slot="card-content"
        className={cn(
          "flex flex-1 flex-col",
          compact ? compactGapSpacing[size] : gapSpacing[size],
          insetClasses,
          className
        )}
        {...props}
      />
    )
  }
)

const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function CardFooter({ className, ...props }, ref) {
    const { size, compact, inset } = useCardContext()
    const insetClasses =
      inset === "all"
        ? [horizontalInsetSpacing[size].negative, horizontalInsetSpacing[size].padding]
        : []

    const paddingTop = compact ? footerPaddingTop[size].compact : footerPaddingTop[size].regular
    const footerGap = compact ? compactGapSpacing[size] : actionGapSpacing[size]

    return (
      <div
        ref={ref}
        data-slot="card-footer"
        className={cn(
          "flex items-center justify-between border-t border-border/60",
          paddingTop,
          insetClasses,
          footerGap,
          className
        )}
        {...props}
      />
    )
  }
)

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
