import * as React from "react"

import { cn } from "@/lib/utils"

type ContainerSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full"

const sizeClass: Record<ContainerSize, string> = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-7xl",
  "2xl": "max-w-screen-2xl",
  full: "w-full",
}

type PolymorphicProps<T extends keyof JSX.IntrinsicElements> = {
  as?: T
  size?: ContainerSize
  className?: string
  children?: React.ReactNode
} & Omit<JSX.IntrinsicElements[T], "className" | "children">

export function Container<T extends keyof JSX.IntrinsicElements = "div">(
  props: PolymorphicProps<T>,
) {
  const { as, size = "xl", className, children, ...rest } = props
  const Comp = (as ?? "div") as React.ElementType
  const widthClass = sizeClass[size]

  return (
    <Comp
      className={cn("mx-auto px-4 sm:px-6 lg:px-8", widthClass, className)}
      {...rest}
    >
      {children}
    </Comp>
  )
}
