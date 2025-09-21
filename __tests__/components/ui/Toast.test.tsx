import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Toast } from "@/components/ui/toast"

describe("Toast", () => {
  it("renders dismissible content and invokes callbacks", async () => {
    const user = userEvent.setup()
    const handleClose = jest.fn()
    const handleAction = jest.fn()

    render(
      <Toast
        tone="danger"
        title="Sync failed"
        description="Retry or download a backup."
        action={{ label: "Retry", onClick: handleAction }}
        onClose={handleClose}
      />
    )

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive")

    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(handleAction).toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /dismiss/i }))
    expect(handleClose).toHaveBeenCalled()
  })
})
