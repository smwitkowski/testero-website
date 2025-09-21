import { render } from "@testing-library/react"

import { Section } from "../section"

describe("Section", () => {
  it("renders with default variants and container", () => {
    const { container } = render(<Section>Content</Section>)

    const section = container.querySelector("section")
    expect(section).toBeInTheDocument()
    expect(section).toHaveClass("bg-surface")

    const inner = section?.querySelector(":scope > div")
    expect(inner).toHaveClass("py-section_lg")

    const contained = inner?.firstElementChild as HTMLElement | null
    expect(contained).toHaveClass("mx-auto")
    expect(contained?.textContent).toBe("Content")
  })

  it("supports variant overrides and uncontained layout", () => {
    const { container } = render(
      <Section
        as="article"
        size="sm"
        surface="muted"
        divider="both"
        contained={false}
        className="custom"
      >
        <p>Inner content</p>
      </Section>,
    )

    const section = container.querySelector("article")
    expect(section).toBeInTheDocument()
    expect(section).toHaveClass("bg-surface-muted", "border-y", "border-divider", "custom")

    const inner = section?.querySelector(":scope > div")
    expect(inner).toHaveClass("py-section_sm")

    const contained = inner?.firstElementChild as HTMLElement | null
    expect(contained).not.toHaveClass("mx-auto")
    expect(contained?.tagName.toLowerCase()).toBe("p")
  })
})
