import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import {
  buttonBase,
  buttonSizeStyles,
  buttonVariantStyles,
} from "@/lib/design-system/components"

const button = cva(buttonBase, {
  variants: {
    variant: {
      solid: buttonVariantStyles.solid,
      soft: buttonVariantStyles.soft,
      outline: buttonVariantStyles.outline,
      ghost: buttonVariantStyles.ghost,
      link: buttonVariantStyles.link,
    },
    tone: {
      default: buttonVariantStyles.tone.default,
      accent: buttonVariantStyles.tone.accent,
      success: buttonVariantStyles.tone.success,
      warn: buttonVariantStyles.tone.warn,
      danger: buttonVariantStyles.tone.danger,
      neutral: buttonVariantStyles.tone.neutral,
    },
    size: {
      sm: buttonSizeStyles.sm,
      md: buttonSizeStyles.md,
      lg: buttonSizeStyles.lg,
    },
    fullWidth: {
      true: "w-full",
    },
  },
  defaultVariants: {
    variant: "solid",
    tone: "accent",
    size: "md",
  },
})

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (value: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value)
      } else if (ref) {
        ;(ref as React.MutableRefObject<T | null>).current = value
      }
    }
  }
}

/**
 * The canonical button component for the Testero design system.
 *
 * @remarks
 * - `variant` controls the structural treatment (`solid`, `soft`, `outline`, `ghost`, `link`).
 * - `tone` applies semantic color intent mapped to tokens (`default`, `accent`, `success`, `warn`, `danger`, `neutral`).
 * - `size` ensures token-backed spacing with md/lg meeting a ≥44px hit area.
 * - `loading` shows a spinner, disables pointer interaction, and marks the control as busy.
 * - `icon`/`iconRight` render leading and trailing affordances while preserving accessible labels.
 * - `fullWidth` stretches the button to the available width while retaining variant styling.
 */
export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> &
  VariantProps<typeof button> & {
    /** Visually replaces the content with a spinner and prevents user interaction. */
    loading?: boolean
    /** Optional leading icon, rendered before the children. */
    icon?: React.ReactNode
    /** Optional trailing icon, rendered after the children. */
    iconRight?: React.ReactNode
    /** Render the button as a different element while preserving styling. */
    asChild?: boolean
    /** Override the intrinsic button type (defaults to `button`). */
    type?: "button" | "submit" | "reset"
  }

const Spinner = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={cn("size-4 animate-spin text-current", className)}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      d="M4 12a8 8 0 018-8V2a10 10 0 100 20v-2a8 8 0 01-8-8z"
      fill="currentColor"
    />
  </svg>
)

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      className,
      variant,
      tone,
      size,
      fullWidth,
      loading = false,
      icon,
      iconRight,
      disabled,
      type = "button",
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading
    const buttonClassName = cn(
      button({ variant, tone, size, fullWidth }),
      loading && "cursor-progress",
      className
    )

    const childContent =
      asChild && React.isValidElement(children)
        ? (children.props as { children?: React.ReactNode }).children
        : children

    const content = (
      <>
        {loading ? (
          <Spinner className="mr-2" />
        ) : icon ? (
          <span className="-ml-0.5 mr-2 flex shrink-0 items-center">{icon}</span>
        ) : null}
        <span className="inline-flex min-w-0 items-center justify-center">{childContent}</span>
        {iconRight && !loading ? (
          <span className="ml-2 -mr-0.5 flex shrink-0 items-center">{iconRight}</span>
        ) : null}
      </>
    )

    const { onClick, ...restProps } = props

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement
      const childOnClick = child.props?.onClick as React.MouseEventHandler<unknown> | undefined

      return React.cloneElement(child, {
        ...restProps,
        className: cn(buttonClassName, child.props.className),
        "data-variant": variant ?? "solid",
        "data-tone": tone ?? "accent",
        "data-loading": loading ? "true" : undefined,
        "data-disabled": isDisabled ? "true" : undefined,
        "aria-disabled": isDisabled || undefined,
        "aria-busy": loading || undefined,
        ref: mergeRefs(child.ref as React.Ref<unknown>, ref as React.Ref<unknown>),
        onClick: (event: React.MouseEvent<unknown>) => {
          if (isDisabled) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          childOnClick?.(event)
          ;(onClick as React.MouseEventHandler<unknown> | undefined)?.(event)
        },
        children: content,
      })
    }

    return (
      <button
        ref={ref}
        type={type}
        data-variant={variant ?? "solid"}
        data-tone={tone ?? "accent"}
        data-loading={loading ? "true" : undefined}
        data-disabled={isDisabled ? "true" : undefined}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        disabled={isDisabled}
        className={buttonClassName}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          ;(onClick as React.MouseEventHandler<HTMLButtonElement> | undefined)?.(event)
        }}
        {...restProps}
      >
        {content}
      </button>
    )
  }
)

Button.displayName = "Button"

export { button as buttonVariants }
