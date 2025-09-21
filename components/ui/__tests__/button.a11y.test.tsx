import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Button } from "../button"

describe("Button accessibility", () => {
  it("renders supported variants and tones", () => {
    const { container } = render(
      <div className="flex flex-wrap gap-2">
        {(["solid", "soft", "outline", "ghost", "link"] as const).map((variant) => (
          <Button key={variant} variant={variant} tone="accent" size="sm">
            {variant}
          </Button>
        ))}
        {(["default", "accent", "success", "warn", "danger", "neutral"] as const).map((tone) => (
          <Button key={tone} variant="solid" tone={tone} size="md">
            {tone}
          </Button>
        ))}
      </div>
    )

    expect(container.querySelectorAll("button").length).toBeGreaterThan(0)
  })

  it("exposes focus-visible ring classes for keyboard users", async () => {
    const user = userEvent.setup()
    render(<Button>Focus me</Button>)

    await user.tab()
    const button = screen.getByRole("button", { name: "Focus me" })

    expect(document.activeElement).toBe(button)
    expect(button.className).toEqual(expect.stringContaining("focus-visible:ring-2"))
    expect(button.className).toEqual(expect.stringContaining("focus-visible:ring-offset-2"))
  })

  it("prevents interaction when disabled or loading", async () => {
    const user = userEvent.setup()
    const onClick = jest.fn()

    render(
      <div className="space-y-2">
        <Button onClick={onClick} disabled>
          Disabled
        </Button>
        <Button onClick={onClick} loading icon={<span aria-hidden="true" />}>
          Loading
        </Button>
      </div>
    )

    const disabledButton = screen.getByRole("button", { name: "Disabled" })
    const loadingButton = screen.getByRole("button", { name: "Loading" })

    await user.click(disabledButton)
    await user.click(loadingButton)

    expect(onClick).not.toHaveBeenCalled()
    expect(disabledButton).toHaveAttribute("aria-disabled", "true")
    expect(loadingButton).toHaveAttribute("aria-disabled", "true")
    expect(loadingButton).toHaveAttribute("aria-busy", "true")
    expect(loadingButton.querySelector("svg")).toBeTruthy()
  })
})
