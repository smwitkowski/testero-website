import { cva } from "class-variance-authority"

export const pageHeaderRoot = cva(
  "w-full border-b border-border/60 bg-background text-foreground",
  {
    variants: {
      tone: {
        default: "bg-background",
        muted: "bg-muted/60 backdrop-blur-sm",
      },
      density: {
        comfortable: "py-8 md:py-12",
        compact: "py-4 md:py-6",
      },
    },
    defaultVariants: {
      tone: "default",
      density: "comfortable",
    },
  }
)

export const pageHeaderInner = cva("container flex w-full flex-col gap-6", {
  variants: {
    align: {
      left: "items-start",
      between: "md:flex-row md:items-center md:justify-between",
    },
    density: {
      comfortable: "gap-6",
      compact: "gap-4",
    },
  },
  defaultVariants: {
    align: "left",
    density: "comfortable",
  },
})

export const pageHeaderText = cva("flex flex-col gap-4", {
  variants: {
    density: {
      comfortable: "gap-4",
      compact: "gap-3",
    },
    align: {
      left: "text-left",
      between: "text-left",
    },
  },
  defaultVariants: {
    density: "comfortable",
    align: "left",
  },
})

export const pageHeaderTitle = cva(
  "font-semibold tracking-tight text-foreground",
  {
    variants: {
      density: {
        comfortable: "text-3xl leading-tight sm:text-4xl",
        compact: "text-2xl leading-snug sm:text-3xl",
      },
    },
    defaultVariants: {
      density: "comfortable",
    },
  }
)

export const pageHeaderDescription = cva(
  "max-w-2xl text-base text-muted-foreground",
  {
    variants: {
      density: {
        comfortable: "leading-7",
        compact: "text-sm leading-6",
      },
    },
    defaultVariants: {
      density: "comfortable",
    },
  }
)

export const pageHeaderBreadcrumbs = cva(
  "flex flex-wrap items-center gap-2 text-sm text-muted-foreground",
  {
    variants: {
      density: {
        comfortable: "",
        compact: "text-xs",
      },
    },
    defaultVariants: {
      density: "comfortable",
    },
  }
)

export const pageHeaderActions = cva("flex flex-wrap items-center gap-3", {
  variants: {
    density: {
      comfortable: "gap-3",
      compact: "gap-2",
    },
  },
  defaultVariants: {
    density: "comfortable",
  },
})
