import { cva } from "class-variance-authority"

export const tableContainer = cva(
  "w-full overflow-hidden rounded-xl border border-border/60 bg-card text-foreground shadow-sm",
  {
    variants: {
      density: {
        comfortable: "",
        compact: "text-sm",
      },
      zebra: {
        true: "[&>table>tbody>tr:nth-child(even)]:bg-muted/60",
      },
    },
    defaultVariants: {
      density: "comfortable",
    },
  }
)

export const tableRoot = cva(
  "min-w-full border-collapse text-left", 
  {
    variants: {
      density: {
        comfortable: "",
        compact: "",
      },
    },
    defaultVariants: {
      density: "comfortable",
    },
  }
)

export const tableHeaderRow = cva("border-b border-border/80 bg-muted/40", {
  variants: {
    sticky: {
      true: "sticky top-0 z-10",
    },
  },
})

export const tableHeaderCell = cva(
  "whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground",
  {
    variants: {
      align: {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      },
      density: {
        comfortable: "px-4 py-3",
        compact: "px-3 py-2 text-xs",
      },
    },
    defaultVariants: {
      align: "left",
      density: "comfortable",
    },
  }
)

export const tableCell = cva(
  "border-b border-border/60 text-sm text-foreground align-middle",
  {
    variants: {
      align: {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      },
      density: {
        comfortable: "px-4 py-3",
        compact: "px-3 py-2 text-sm",
      },
    },
    defaultVariants: {
      align: "left",
      density: "comfortable",
    },
  }
)

export const tableRow = cva("transition-colors hover:bg-muted/40", {
  variants: {
    density: {
      comfortable: "",
      compact: "",
    },
  },
})
