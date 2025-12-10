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
  sm: "px-3",           // 12px
  md: "px-4 md:px-6",   // 16px mobile, 24px desktop
  lg: "px-6",           // 24px
}

const verticalPadding: Record<CardSize, string> = {
  sm: "py-3",           // 12px
  md: "py-4 md:py-6",   // 16px mobile, 24px desktop
  lg: "py-6",           // 24px
}

const compactVerticalPadding: Record<CardSize, string> = {
  sm: "py-3",           // 12px
  md: "py-3",           // 12px
  lg: "py-4",           // 16px
}

const gapSpacing: Record<CardSize, string> = {
  sm: "gap-2",          // 8px
  md: "gap-3",          // 12px
  lg: "gap-4",          // 16px
}

const compactGapSpacing: Record<CardSize, string> = {
  sm: "gap-2",
  md: "gap-2",
  lg: "gap-3",
}

const sectionGapSpacing: Record<CardSize, string> = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
}

const footerPaddingTop: Record<CardSize, { regular: string; compact: string }> = {
  sm: { regular: "pt-3", compact: "pt-3" },
  md: { regular: "pt-4", compact: "pt-3" },
  lg: { regular: "pt-6", compact: "pt-4" },
}

const actionGapSpacing: Record<CardSize, string> = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
}

const horizontalInsetSpacing: Record<CardSize, { negative: string; padding: string }> = {
  sm: { negative: "-mx-3", padding: "px-3" },
  md: { negative: "-mx-4", padding: "px-4" },
  lg: { negative: "-mx-6", padding: "px-6" },
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
