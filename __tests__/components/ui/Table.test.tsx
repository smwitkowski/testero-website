import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Table, type TableColumn } from "@/components/ui/table"

type Row = {
  id: string
  experiment: string
  conversions: number
}

const columns: TableColumn<Row>[] = [
  { id: "experiment", header: "Experiment", sortable: true },
  { id: "conversions", header: "Conversions", align: "right", sortable: true },
]

const data: Row[] = [
  { id: "1", experiment: "Pricing", conversions: 200 },
  { id: "2", experiment: "Onboarding", conversions: 120 },
]

describe("Table", () => {
  it("renders rows and triggers sort events", async () => {
    const user = userEvent.setup()
    const handleSort = jest.fn()

    render(
      <Table<Row>
        columns={columns}
        data={data}
        caption="Experiments table"
        onSortChange={handleSort}
      />
    )

    expect(screen.getByRole("table", { name: /experiments table/i })).toBeInTheDocument()
    expect(screen.getByText("Pricing")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /experiment/i }))
    expect(handleSort).toHaveBeenCalledWith("experiment", "asc")
  })

  it("shows the default empty state when no data is present", () => {
    render(
      <Table<Row>
        columns={columns}
        data={[]}
        caption="Empty table"
      />
    )

    expect(screen.getByText(/no data yet/i)).toBeInTheDocument()
  })
})
