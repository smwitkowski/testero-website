import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "jest-axe"

import { Button } from "@/components/ui/button"

describe("Button accessibility", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark")
  })

  it("has no detectable axe violations for representative variants in light mode", async () => {
    const { container } = render(
      <div>
        <Button>Primary action</Button>
        <Button variant="outline" tone="neutral" size="sm" className="mt-4">
          Secondary action
        </Button>
      </div>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it("remains accessible in dark mode", async () => {
    document.documentElement.classList.add("dark")
    const { container } = render(
      <div className="dark">
        <Button tone="accent">Dark theme action</Button>
      </div>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it("exposes button semantics and a visible focus treatment", async () => {
    const user = userEvent.setup()
    render(<Button>Accessible button</Button>)

    const button = screen.getByRole("button", { name: /accessible button/i })
    expect(button).toHaveAttribute("type", "button")

    await user.tab()
    expect(button).toHaveFocus()
    expect(button).toHaveClass("focus-visible:ring-2")
    expect(button).toHaveClass("focus-visible:ring-offset-2")
  })

  it("respects disabled and loading semantics without removing keyboard access when aria-disabled", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Button disabled>Disabled state</Button>)

    const disabledButton = screen.getByRole("button", { name: /disabled state/i })
    expect(disabledButton).toBeDisabled()
    expect(disabledButton).toHaveAttribute("aria-disabled", "true")

    rerender(<Button loading>Disabled state</Button>)
    const loadingButton = screen.getByRole("button", { name: /disabled state/i })
    expect(loadingButton).toBeDisabled()
    expect(loadingButton).toHaveAttribute("aria-busy", "true")

    rerender(
      <Button asChild disabled>
        <a href="#link-target">Learn more</a>
      </Button>
    )
    const linkButton = screen.getByRole("link", { name: /learn more/i })
    expect(linkButton).toHaveAttribute("aria-disabled", "true")

    await user.tab()
    expect(linkButton).toHaveFocus()
  })
})
