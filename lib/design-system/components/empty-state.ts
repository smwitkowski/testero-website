import { cva } from "class-variance-authority"

export const emptyStateRoot = cva(
  "flex w-full flex-col rounded-2xl border border-border/60 bg-card text-foreground shadow-sm transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-card",
        info: "border-info/50 bg-info/10", 
        success: "border-success/50 bg-success/10",
        warning: "border-warning/60 bg-warning/10",
        danger: "border-destructive/60 bg-destructive/10",
      },
      size: {
        sm: "gap-4 p-6",
        md: "gap-5 p-8",
        lg: "gap-6 p-10",
      },
      alignment: {
        center: "items-center text-center",
        left: "items-start text-left",
      },
      elevated: {
        true: "shadow-md",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
      alignment: "center",
    },
  }
)

export const emptyStateIcon = cva(
  "flex size-12 items-center justify-center rounded-full border border-border/50 bg-background text-2xl",
  {
    variants: {
      tone: {
        neutral: "text-muted-foreground",
        info: "border-info/40 text-info",
        success: "border-success/40 text-success",
        warning: "border-warning/50 text-warning",
        danger: "border-destructive/50 text-destructive",
      },
      size: {
        sm: "size-10 text-lg",
        md: "size-12 text-xl",
        lg: "size-14 text-2xl",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  }
)

export const emptyStateTitle = cva(
  "font-semibold text-foreground",
  {
    variants: {
      size: {
        sm: "text-lg leading-6",
        md: "text-xl leading-7",
        lg: "text-2xl leading-8",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export const emptyStateDescription = cva(
  "max-w-xl text-muted-foreground",
  {
    variants: {
      size: {
        sm: "text-sm leading-6",
        md: "text-base leading-7",
        lg: "text-lg leading-8",
      },
      alignment: {
        center: "text-center",
        left: "text-left",
      },
    },
    defaultVariants: {
      size: "md",
      alignment: "center",
    },
  }
)

export const emptyStateActions = cva("flex flex-wrap gap-3", {
  variants: {
    alignment: {
      center: "justify-center",
      left: "justify-start",
    },
  },
  defaultVariants: {
    alignment: "center",
  },
})
