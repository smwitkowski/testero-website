import { cva } from "class-variance-authority"

export const toastRoot = cva(
  "pointer-events-auto grid w-full max-w-sm gap-3 rounded-xl border border-border/60 bg-card p-4 text-foreground transition-all duration-200 ease-out focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-background motion-reduce:transition-none",
  {
    variants: {
      tone: {
        info: "border-info/60 bg-info/10",
        success: "border-success/60 bg-success/10",
        warning: "border-warning/60 bg-warning/10",
        danger: "border-destructive/60 bg-destructive/10",
      },
      elevation: {
        none: "shadow-none",
        sm: "shadow-sm",
        md: "shadow-md",
      },
      dismissible: {
        true: "pr-3",
      },
    },
    defaultVariants: {
      tone: "info",
      elevation: "sm",
    },
  }
)

export const toastTitle = cva("text-sm font-semibold text-foreground", {
  variants: {
    tone: {
      info: "text-foreground",
      success: "text-success",
      warning: "text-warning",
      danger: "text-destructive",
    },
  },
  defaultVariants: {
    tone: "info",
  },
})

export const toastDescription = cva("text-sm text-muted-foreground", {
  variants: {
    tone: {
      info: "text-muted-foreground",
      success: "text-success/80",
      warning: "text-warning/90",
      danger: "text-destructive/90",
    },
  },
  defaultVariants: {
    tone: "info",
  },
})

export const toastActions = cva("mt-1 flex flex-wrap items-center gap-3", {
  variants: {
    dismissible: {
      true: "justify-between",
    },
  },
})
