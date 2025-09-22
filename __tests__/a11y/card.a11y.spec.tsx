import { render, screen } from "@testing-library/react"
import { axe } from "jest-axe"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

describe("Card accessibility", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark")
  })

  const renderCard = () =>
    render(
      <Card
        aria-labelledby="plan-title"
        aria-describedby="plan-description"
        role="group"
        variant="elevated"
        size="lg"
      >
        <CardHeader>
          <CardTitle id="plan-title">Pro plan</CardTitle>
          <CardDescription id="plan-description">
            Includes advanced analytics and adaptive learning tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Adaptive practice sessions tailored to your goals.</p>
          <ul>
            <li>Unlimited mock exams</li>
            <li>In-depth performance insights</li>
          </ul>
        </CardContent>
        <CardFooter>
          <CardAction>
            <Button>Choose plan</Button>
          </CardAction>
        </CardFooter>
      </Card>
    )

  it("renders semantic structure that can be referenced by assistive tech", () => {
    const { container } = renderCard()
    const card = screen.getByRole("group", { name: /pro plan/i })

    expect(card).toHaveAttribute("aria-describedby", "plan-description")
    expect(card.querySelector('[data-slot="card-header"]')).not.toBeNull()
    expect(card.querySelector('[data-slot="card-content"]')).not.toBeNull()
    expect(card.querySelector('[data-slot="card-footer"]')).not.toBeNull()

    expect(container.querySelectorAll("[data-slot='card-action']")).toHaveLength(1)
  })

  it("has no detectable axe violations in light mode", async () => {
    const { container } = renderCard()
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it("has no detectable axe violations in dark mode", async () => {
    document.documentElement.classList.add("dark")
    const { container } = render(
      <div className="dark">
        <Card aria-labelledby="alt-plan" aria-describedby="alt-description">
          <CardHeader>
            <CardTitle id="alt-plan">Starter plan</CardTitle>
            <CardDescription id="alt-description">
              Designed for newcomers exploring certification prep.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Includes two guided learning paths and weekly reminders.</p>
          </CardContent>
        </Card>
      </div>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
