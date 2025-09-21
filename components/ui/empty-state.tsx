import * as React from "react"
import { type VariantProps } from "class-variance-authority"

import {
  emptyStateActions,
  emptyStateDescription,
  emptyStateIcon,
  emptyStateRoot,
  emptyStateTitle,
} from "@/lib/design-system/components"
import { cn } from "@/lib/utils"
import { Button } from "./button"

type EmptyStateRootVariants = VariantProps<typeof emptyStateRoot>

type EmptyStateTone = NonNullable<EmptyStateRootVariants["tone"]>
type EmptyStateSize = NonNullable<EmptyStateRootVariants["size"]>
type EmptyStateAlignment = NonNullable<EmptyStateRootVariants["alignment"]>

type ButtonTone = NonNullable<React.ComponentProps<typeof Button>["tone"]>

export interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
}

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    EmptyStateRootVariants {
  title: string
  icon?: React.ReactNode
  iconAriaLabel?: string
  statusLabel?: string
  description?: React.ReactNode
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
}

const toneToButtonTone: Record<EmptyStateTone, ButtonTone> = {
  neutral: "accent",
  info: "accent",
  success: "success",
  warning: "warn",
  danger: "danger",
}

const toneLabelMap: Record<EmptyStateTone, string> = {
  neutral: "Heads up",
  info: "Informational",
  success: "Success",
  warning: "Warning",
  danger: "Critical",
}

const toneLabelClassMap: Record<EmptyStateTone, string> = {
  neutral: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon,
      iconAriaLabel,
      statusLabel,
      title,
      description,
      primaryAction,
      secondaryAction,
      tone = "neutral",
      size = "md",
      alignment = "center",
      elevated,
      className,
      ...props
    },
    ref
  ) => {
    const resolvedTone: EmptyStateTone = tone ?? "neutral"
    const resolvedSize: EmptyStateSize = size ?? "md"
    const resolvedAlignment: EmptyStateAlignment = alignment ?? "center"

    const resolvedStatusLabel = statusLabel ?? toneLabelMap[resolvedTone]
    const role = resolvedTone === "danger" || resolvedTone === "warning" ? "alert" : "status"
    const ariaLive = role === "alert" ? "assertive" : "polite"

    const descriptionContent = React.useMemo(() => {
      if (!description) return null

      if (typeof description === "string") {
        return (
          <p
            className={cn(
              emptyStateDescription({ size: resolvedSize, alignment: resolvedAlignment })
            )}
          >
            {description}
          </p>
        )
      }

      if (React.isValidElement(description)) {
        const element = description as React.ReactElement<{ className?: string }>
        return React.cloneElement(element, {
          className: cn(
            emptyStateDescription({ size: resolvedSize, alignment: resolvedAlignment }),
            element.props.className
          ),
        })
      }

      return (
        <div
          className={cn(
            emptyStateDescription({ size: resolvedSize, alignment: resolvedAlignment })
          )}
        >
          {description}
        </div>
      )
    }, [description, resolvedAlignment, resolvedSize])

    const renderAction = (
      action: EmptyStateAction,
      variant: "primary" | "secondary"
    ) => {
      if (!action) return null
      const buttonTone = toneToButtonTone[resolvedTone]
      const variantConfig =
        variant === "primary"
          ? { variant: "solid" as const, tone: buttonTone }
          : { variant: "ghost" as const, tone: "neutral" as ButtonTone }

      if (action.href) {
        return (
          <Button asChild variant={variantConfig.variant} tone={variantConfig.tone}>
            <a href={action.href} onClick={action.onClick}>
              {action.label}
            </a>
          </Button>
        )
      }

      return (
        <Button
          variant={variantConfig.variant}
          tone={variantConfig.tone}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )
    }

    return (
      <div
        ref={ref}
        role={role}
        aria-live={ariaLive}
        className={cn(
          emptyStateRoot({
            tone: resolvedTone,
            size: resolvedSize,
            alignment: resolvedAlignment,
            elevated: elevated ? true : undefined,
          }),
          className
        )}
        {...props}
      >
        {icon ? (
          <span
            className={cn(emptyStateIcon({ tone: resolvedTone, size: resolvedSize }))}
            role={iconAriaLabel ? "img" : undefined}
            aria-label={iconAriaLabel}
            aria-hidden={iconAriaLabel ? undefined : "true"}
          >
            {icon}
          </span>
        ) : null}

        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            toneLabelClassMap[resolvedTone]
          )}
        >
          {resolvedStatusLabel}
        </span>

        <h2 className={cn(emptyStateTitle({ size: resolvedSize }))}>{title}</h2>
        {descriptionContent}

        {(primaryAction || secondaryAction) && (
          <div className={cn(emptyStateActions({ alignment: resolvedAlignment }))}>
            {secondaryAction ? renderAction(secondaryAction, "secondary") : null}
            {primaryAction ? renderAction(primaryAction, "primary") : null}
          </div>
        )}
      </div>
    )
  }
)

EmptyState.displayName = "EmptyState"
