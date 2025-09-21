import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react"

import {
  tableCell,
  tableContainer,
  tableHeaderCell,
  tableHeaderRow,
  tableRoot,
  tableRow,
} from "@/lib/design-system/components"
import { cn } from "@/lib/utils"
import { EmptyState } from "./empty-state"

type TableContainerVariants = VariantProps<typeof tableContainer>

type DensityVariant = NonNullable<TableContainerVariants["density"]>

export type SortDirection = "asc" | "desc"

export interface TableColumn<TData> {
  id: string
  header: React.ReactNode
  accessor?: (row: TData) => React.ReactNode
  align?: "left" | "center" | "right"
  width?: string
  sortable?: boolean
}

export interface TableProps<TData>
  extends React.HTMLAttributes<HTMLDivElement>,
    TableContainerVariants {
  columns: TableColumn<TData>[]
  data: TData[]
  caption?: string
  captionClassName?: string
  tableProps?: React.TableHTMLAttributes<HTMLTableElement>
  isLoading?: boolean
  emptyState?: React.ReactNode
  onSortChange?: (columnId: string, direction: SortDirection | null) => void
  sort?: { id: string; dir: SortDirection }
  stickyHeader?: boolean
  getRowId?: (row: TData, index: number) => string
}

const LoadingIndicator = ({ density }: { density: DensityVariant }) => (
  <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
    <span
      aria-hidden="true"
      className={cn(
        "size-4 animate-spin rounded-full border-2 border-border/80 border-t-transparent",
        density === "compact" ? "size-3" : "size-4"
      )}
    />
    <span>Loading</span>
  </div>
)

export const Table = <TData,>(
  {
    columns,
    data,
    caption,
    captionClassName,
    tableProps,
    isLoading,
    emptyState,
    onSortChange,
    sort,
    density = "comfortable",
    zebra,
    stickyHeader,
    getRowId,
    className,
    ...rest
  }: TableProps<TData>
) => {
  const colSpan = Math.max(columns.length, 1)
  const resolvedDensity: DensityVariant = density ?? "comfortable"

  const renderCellContent = React.useCallback(
    (row: TData, column: TableColumn<TData>) => {
      if (column.accessor) {
        return column.accessor(row)
      }

      const value = (row as Record<string, unknown>)[column.id]
      if (React.isValidElement(value)) {
        return value
      }

      if (typeof value === "string" || typeof value === "number") {
        return value
      }

      if (value === null || value === undefined) {
        return "—"
      }

      return String(value)
    },
    []
  )

  const getSortState = (columnId: string): SortDirection | null => {
    if (!sort || sort.id !== columnId) return null
    return sort.dir
  }

  const handleSort = (column: TableColumn<TData>) => {
    if (!onSortChange || !column.sortable) return

    const current = getSortState(column.id)
    const next: SortDirection | null = current === "asc" ? "desc" : current === "desc" ? null : "asc"
    onSortChange(column.id, next)
  }

  const defaultEmpty = (
    <EmptyState
      tone="neutral"
      alignment="center"
      size={resolvedDensity === "compact" ? "sm" : "md"}
      title="No data yet"
      description="Once data is available it will appear here."
    />
  )

  return (
    <div
      className={cn(tableContainer({ density: resolvedDensity, zebra }), className)}
      {...rest}
    >
      <div className="relative w-full overflow-x-auto">
        <table
          className={cn(tableRoot({ density: resolvedDensity }))}
          aria-busy={isLoading || undefined}
          {...tableProps}
        >
          {caption ? (
            <caption className={cn("sr-only", captionClassName)}>{caption}</caption>
          ) : null}
          <thead>
            <tr className={cn(tableHeaderRow({ sticky: stickyHeader ? true : undefined }))}>
              {columns.map((column) => {
                const sortState = getSortState(column.id)
                const isSortable = Boolean(onSortChange && column.sortable)
                const ariaSort: React.AriaAttributes["aria-sort"] = sortState
                  ? sortState === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
                const textAlignment =
                  column.align === "right"
                    ? "text-right"
                    : column.align === "center"
                    ? "text-center"
                    : "text-left"
                const justifyAlignment =
                  column.align === "right"
                    ? "justify-end"
                    : column.align === "center"
                    ? "justify-center"
                    : "justify-between"

                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={isSortable ? ariaSort : undefined}
                    className={cn(
                      tableHeaderCell({ density: resolvedDensity, align: column.align }),
                      "align-middle"
                    )}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-1 py-1 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          textAlignment,
                          justifyAlignment
                        )}
                      >
                        <span className="truncate">{column.header}</span>
                        <span className="flex items-center text-muted-foreground" aria-hidden="true">
                          {sortState === "asc" ? (
                            <ChevronUp className="size-4" />
                          ) : sortState === "desc" ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ArrowUpDown className="size-4" />
                          )}
                        </span>
                        <span className="sr-only">
                          {sortState === "asc"
                            ? "Sort descending"
                            : sortState === "desc"
                            ? "Clear sorting"
                            : "Sort ascending"}
                        </span>
                      </button>
                    ) : (
                      <span className={cn("block truncate", textAlignment)}>{column.header}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr className={cn(tableRow({ density: resolvedDensity }))}>
                <td
                  colSpan={colSpan}
                  className={cn(
                    tableCell({ density: resolvedDensity, align: "center" }),
                    "py-10"
                  )}
                  aria-live="polite"
                >
                  <LoadingIndicator density={resolvedDensity} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr className={cn(tableRow({ density: resolvedDensity }))}>
                <td
                  colSpan={colSpan}
                  className={cn(
                    tableCell({ density: resolvedDensity, align: "center" }),
                    "py-12"
                  )}
                >
                  {emptyState ?? defaultEmpty}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const rowKey = getRowId ? getRowId(row, rowIndex) : `${rowIndex}`
                return (
                  <tr key={rowKey} className={cn(tableRow({ density: resolvedDensity }))}>
                    {columns.map((column) => (
                      <td
                        key={`${rowKey}-${column.id}`}
                        className={cn(
                          tableCell({ density: resolvedDensity, align: column.align })
                        )}
                        style={column.width ? { width: column.width } : undefined}
                      >
                        <div className="min-w-0 truncate">
                          {renderCellContent(row, column)}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

Table.displayName = "Table"
