import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { Sparkles } from "lucide-react"

import { Badge } from "../badge"
import { Table, type SortDirection, type TableColumn, type TableProps } from "../table"
import { EmptyState } from "../empty-state"

type ExperimentRow = {
  id: string
  experiment: string
  owner: string
  status: "Running" | "Paused" | "Draft"
  conversions: number
  updated: string
}

const columns: TableColumn<ExperimentRow>[] = [
  {
    id: "experiment",
    header: "Experiment",
    accessor: (row) => row.experiment,
    sortable: true,
    width: "28%",
  },
  {
    id: "owner",
    header: "Owner",
    accessor: (row) => row.owner,
    sortable: true,
  },
  {
    id: "status",
    header: "Status",
    accessor: (row) => (
      <Badge variant="secondary" className="font-medium">
        {row.status}
      </Badge>
    ),
  },
  {
    id: "conversions",
    header: "Conversions",
    accessor: (row) => row.conversions.toLocaleString(),
    align: "right",
    sortable: true,
  },
  {
    id: "updated",
    header: "Last updated",
    accessor: (row) => row.updated,
    sortable: true,
  },
]

const data: ExperimentRow[] = [
  {
    id: "exp-01",
    experiment: "Pricing paywall copy",
    owner: "Leah Griffin",
    status: "Running",
    conversions: 1420,
    updated: "2025-02-14",
  },
  {
    id: "exp-02",
    experiment: "Onboarding checklist",
    owner: "Ibrahim Noor",
    status: "Paused",
    conversions: 980,
    updated: "2025-02-11",
  },
  {
    id: "exp-03",
    experiment: "New hero illustration",
    owner: "Joana Silva",
    status: "Draft",
    conversions: 312,
    updated: "2025-01-28",
  },
  {
    id: "exp-04",
    experiment: "Free trial CTA",
    owner: "Hector Lin",
    status: "Running",
    conversions: 1845,
    updated: "2025-02-03",
  },
]

const meta: Meta<typeof Table> = {
  title: "Design System/Table",
  component: Table,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    columns,
    data,
    caption: "List of experiments with owner, status, and conversions",
  },
  argTypes: {
    density: {
      control: "inline-radio",
      options: ["comfortable", "compact"],
    },
    zebra: {
      control: "boolean",
    },
  },
}

export default meta

type Story = StoryObj<typeof Table>

type SortState = { id: string; dir: SortDirection } | undefined

const useSortedData = (rows: ExperimentRow[], sort: SortState) => {
  return React.useMemo(() => {
    if (!sort) return rows
    const key = sort.id as keyof ExperimentRow
    return [...rows].sort((a, b) => {
      const aValue = a[key]
      const bValue = b[key]
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sort.dir === "asc" ? aValue - bValue : bValue - aValue
      }
      return sort.dir === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue))
    })
  }, [rows, sort])
}

type ExperimentTableProps = TableProps<ExperimentRow>

const SortingExample: React.FC<ExperimentTableProps> = (props) => {
  const { data: rows, onSortChange, ...rest } = props
  const [sort, setSort] = React.useState<SortState>()
  const sortedRows = useSortedData((rows as ExperimentRow[]) ?? [], sort)

  const handleSortChange = React.useCallback(
    (columnId: string, direction: SortDirection | null) => {
      setSort(direction ? { id: columnId, dir: direction } : undefined)
      onSortChange?.(columnId, direction)
    },
    [onSortChange]
  )

  return (
    <Table<ExperimentRow>
      {...rest}
      data={sortedRows}
      sort={sort}
      onSortChange={handleSortChange}
    />
  )
}

export const InteractiveSorting: Story = {
  render: (args) => (
    <div className="mx-auto max-w-5xl p-6">
      <SortingExample {...(args as ExperimentTableProps)} />
    </div>
  ),
}

export const CompactDensity: Story = {
  render: (args) => (
    <div className="mx-auto max-w-4xl p-6">
      <SortingExample
        {...(args as ExperimentTableProps)}
        density="compact"
        zebra
      />
    </div>
  ),
}

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

export const Empty: Story = {
  args: {
    data: [],
  },
}

export const CustomEmptyState: Story = {
  args: {
    data: [],
    emptyState: (
      <EmptyState
        tone="info"
        icon={<Sparkles aria-hidden="true" className="size-6" />}
        statusLabel="No experiments yet"
        title="Start by launching your first test"
        description="A guided setup will walk you through defining hypotheses and rollout criteria."
        primaryAction={{ label: "Launch experiment", onClick: () => console.log("launch") }}
      />
    ),
  },
}
