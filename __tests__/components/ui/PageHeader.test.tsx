import React from "react"
import { render, screen, within } from "@testing-library/react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"

describe("PageHeader", () => {
  it("renders heading, description, and breadcrumb navigation", () => {
    render(
      <PageHeader
        title="Team analytics"
        description="Understand adoption across teams and take action on outliers."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Analytics", href: "/analytics" },
          { label: "Team" },
        ]}
        actions={<Button>Share</Button>}
      />
    )

    const heading = screen.getByRole("heading", { level: 1, name: "Team analytics" })
    expect(heading).toBeInTheDocument()

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i })
    const items = within(nav).getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(items[2]).toHaveAttribute("aria-current", "page")

    expect(screen.getByText("Share")).toBeInTheDocument()
  })

  it("supports alternate heading levels", () => {
    render(<PageHeader title="Reports" headingLevel="h2" />)

    const heading = screen.getByRole("heading", { level: 2, name: "Reports" })
    expect(heading.tagName.toLowerCase()).toBe("h2")
  })
})
