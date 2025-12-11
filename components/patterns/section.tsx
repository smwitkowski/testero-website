import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

import { Container } from "./Container"

const outer = cva("relative w-full", {
  variants: {
    surface: {
      default: "bg-surface",
      subtle: "bg-surface-subtle",
      muted: "bg-surface-muted",
      elevated: "bg-surface-elevated shadow-sm",
      brand: "bg-surface-brand",
    },
    divider: {
      none: "",
      top: "border-t border-divider",
      bottom: "border-b border-divider",
      both: "border-y border-divider",
    },
  },
  defaultVariants: { surface: "default", divider: "none" },
})

const inner = cva("w-full", {
  variants: {
    size: {
      sm: "py-section-sm",
      md: "py-section-md",
      lg: "py-section-lg",
      xl: "py-section-xl",
    },
  },
  defaultVariants: { size: "lg" },
})

type SectionElement =
  | "section"
  | "div"
  | "header"
  | "footer"
  | "main"
  | "article"
  | "aside"

export type SectionProps<T extends SectionElement = "section"> = {
  as?: T
  contained?: boolean
  className?: string
  children?: React.ReactNode
} & VariantProps<typeof outer> &
  VariantProps<typeof inner> &
  Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">

type SectionComponent = <T extends SectionElement = "section">(
  props: SectionProps<T> & { ref?: React.Ref<React.ElementRef<T>> },
) => React.ReactElement | null

const SectionBase = React.forwardRef(
  <T extends SectionElement = "section">(
    props: SectionProps<T>,
    ref: React.Ref<React.ElementRef<T>>,
  ) => {
    const {
      as,
      surface,
      divider,
      size,
      contained = true,
      className,
      children,
      ...rest
    } = props

    const Component = (as ?? "section") as React.ElementType

    return (
      <Component
        ref={ref}
        className={cn(outer({ surface, divider }), className)}
        {...rest}
      >
        <div className={cn(inner({ size }))}>
          {contained ? <Container>{children}</Container> : children}
        </div>
      </Component>
    )
  },
)

SectionBase.displayName = "Section"

export const Section = SectionBase as SectionComponent
