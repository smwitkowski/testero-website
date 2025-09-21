import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import {
  toastActions,
  toastDescription,
  toastRoot,
  toastTitle,
} from "@/lib/design-system/components"
import { cn } from "@/lib/utils"
import { Button } from "./button"

type ToastRootVariants = VariantProps<typeof toastRoot>

type ToastTone = NonNullable<ToastRootVariants["tone"]>

type ButtonTone = NonNullable<React.ComponentProps<typeof Button>["tone"]>

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    ToastRootVariants {
  title?: string
  description?: React.ReactNode
  action?: ToastAction
  dismissible?: boolean
  onClose?: () => void
}

const toneToButtonTone: Record<ToastTone, ButtonTone> = {
  info: "accent",
  success: "success",
  warning: "warn",
  danger: "danger",
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      title,
      description,
      action,
      dismissible = true,
      onClose,
      tone = "info",
      elevation = "sm",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const role = tone === "danger" || tone === "warning" ? "alert" : "status"
    const ariaLive = role === "alert" ? "assertive" : "polite"
    const buttonTone = toneToButtonTone[tone]

    const descriptionContent = React.useMemo(() => {
      if (!description) return null

      if (typeof description === "string") {
        return <p className={cn(toastDescription({ tone }))}>{description}</p>
      }

      if (React.isValidElement(description)) {
        const element = description as React.ReactElement<{ className?: string }>
        return React.cloneElement(element, {
          className: cn(toastDescription({ tone }), element.props.className),
        })
      }

      return <div className={cn(toastDescription({ tone }))}>{description}</div>
    }, [description, tone])

    return (
      <div
        ref={ref}
        role={role}
        aria-live={ariaLive}
        className={cn(toastRoot({ tone, elevation, dismissible: dismissible ? true : undefined }), className)}
        {...props}
      >
        {title ? <p className={cn(toastTitle({ tone }))}>{title}</p> : null}
        {descriptionContent}
        {children}
        {(action || (dismissible && onClose)) && (
          <div className={cn(toastActions({ dismissible: dismissible && onClose ? true : undefined }))}>
            {action ? (
              <Button variant="link" tone={buttonTone} onClick={action.onClick} className="px-0">
                {action.label}
              </Button>
            ) : null}
            {dismissible && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="sr-only">Dismiss notification</span>
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>
        )}
      </div>
    )
  }
)

Toast.displayName = "Toast"

let toastId = 0

export type ToastQueueItem = ToastProps & { id?: string }
export type ToastQueueEntry = ToastProps & { id: string }

export const useToastQueue = (initialToasts: ToastQueueItem[] = []) => {
  const toEntry = React.useCallback((toast: ToastQueueItem): ToastQueueEntry => ({
    ...toast,
    id: toast.id ?? `toast-${++toastId}`,
  }), [])

  const [toasts, setToasts] = React.useState<ToastQueueEntry[]>(() =>
    initialToasts.map((toast) => toEntry(toast))
  )

  const addToast = React.useCallback((toast: ToastQueueItem) => {
    setToasts((previous) => [...previous, toEntry(toast)])
  }, [toEntry])

  const dismissToast = React.useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}
