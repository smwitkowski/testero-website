import { render, screen } from "@testing-library/react"

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

describe("Card", () => {
  it("applies spacing tokens for each size", () => {
    render(
      <div>
        <Card data-testid="card-sm" size="sm">
          <CardHeader>
            <CardTitle>Small</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-md" size="md">
          <CardHeader>
            <CardTitle>Medium</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-lg" size="lg">
          <CardHeader>
            <CardTitle>Large</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )

    expect(screen.getByTestId("card-sm")).toHaveClass("px-card-x-sm", "py-card-y-sm", "gap-card-sm")
    expect(screen.getByTestId("card-md")).toHaveClass("px-card-x-md", "py-card-y-md", "gap-card-md")
    expect(screen.getByTestId("card-lg")).toHaveClass("px-card-x-lg", "py-card-y-lg", "gap-card-lg")
  })

  it("reduces vertical rhythm when compact", () => {
    render(
      <Card data-testid="card-compact" size="lg" compact>
        <CardHeader>
          <CardTitle>Compact</CardTitle>
        </CardHeader>
        <CardFooter>Footer</CardFooter>
      </Card>
    )

    const card = screen.getByTestId("card-compact")
    expect(card).toHaveClass("px-card-x-lg", "py-card-y-md", "gap-card-md")
    expect(card).not.toHaveClass("py-card-y-lg")
  })

  it("shares inset spacing with content", () => {
    render(
      <Card data-testid="card-inset" inset="content">
        <CardContent data-testid="card-inset-content">Inset body</CardContent>
      </Card>
    )

    const content = screen.getByTestId("card-inset-content")
    expect(content.className).toContain("-mx-card-x-md")
    expect(content.className).toContain("px-card-x-md")
  })
})
