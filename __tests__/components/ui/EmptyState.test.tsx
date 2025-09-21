import React from "react"
import { render, screen } from "@testing-library/react"

import { EmptyState } from "@/components/ui/empty-state"

describe("EmptyState", () => {
  it("renders actions with appropriate labels", () => {
    render(
      <EmptyState
        title="No diagnostics yet"
        description="Create your first diagnostic to compare baselines."
        primaryAction={{ label: "New diagnostic", onClick: jest.fn() }}
        secondaryAction={{ label: "Import data", onClick: jest.fn() }}
      />
    )

    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New diagnostic" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Import data" })).toBeInTheDocument()
  })

  it("elevates severity for danger tone", () => {
    render(
      <EmptyState
        tone="danger"
        title="Upload failed"
        description="Check the template and try again."
      />
    )

    const container = screen.getByRole("alert")
    expect(container).toHaveAttribute("aria-live", "assertive")
  })
})
