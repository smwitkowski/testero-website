/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextBestStepCard } from "@/components/dashboard/NextBestStepCard";

describe("NextBestStepCard", () => {
  it("renders AI RECOMMENDATION badge", () => {
    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={10}
        onDomainCardClick={() => {}}
      />
    );

    expect(screen.getByText("AI RECOMMENDATION")).toBeInTheDocument();
  });

  it("displays domain name and question count in CTA button", () => {
    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={10}
        onDomainCardClick={() => {}}
      />
    );

    expect(screen.getByText("Practice Risk Management")).toBeInTheDocument();
    expect(screen.getByText("10 questions")).toBeInTheDocument();
  });

  it("calls onDomainCardClick when CTA button is clicked", async () => {
    const user = userEvent.setup();
    const onDomainCardClick = jest.fn();

    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={10}
        onDomainCardClick={onDomainCardClick}
      />
    );

    const ctaButton = screen.getByRole("button", { name: /Start recommended practice set for Risk Management/i });
    await user.click(ctaButton);

    expect(onDomainCardClick).toHaveBeenCalledTimes(1);
  });

  it("displays insight text when domainWeight is provided", () => {
    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={10}
        domainWeight={20}
        onDomainCardClick={() => {}}
      />
    );

    // Use getAllByText since the text may appear in multiple DOM nodes, then verify the paragraph exists
    const elements = screen.getAllByText((content, element) => {
      return element?.textContent === "You're strong in Project Initiation but underweight on Risk Management, which carries 20% of the exam.";
    });
    expect(elements.length).toBeGreaterThan(0);
    // Verify at least one is a paragraph element
    expect(elements.some(el => el.tagName === 'P')).toBe(true);
  });

  it("does not display insight text when domainWeight is not provided", () => {
    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={10}
        onDomainCardClick={() => {}}
      />
    );

    expect(
      screen.queryByText(/You're strong in Project Initiation/i)
    ).not.toBeInTheDocument();
  });

  it("renders CTA button with correct tone and accessibility attributes", () => {
    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={10}
        onDomainCardClick={() => {}}
      />
    );

    const button = screen.getByRole("button", { name: /Start recommended practice set for Risk Management/i });
    expect(button).toHaveAttribute("data-tone", "accent");
    expect(button).toHaveAttribute("aria-label", "Start recommended practice set for Risk Management");
  });
});



