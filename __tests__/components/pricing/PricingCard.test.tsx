import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PricingCard } from "@/components/pricing/PricingCard";
import { PMLE_PASS_FEATURES } from "@/lib/pricing/constants";

describe("PricingCard — PMLE Pass", () => {
  it("shows the one-time US$39 offer and 90-day access", () => {
    render(<PricingCard onCheckout={jest.fn()} />);
    expect(screen.getByText("PMLE Pass")).toBeInTheDocument();
    expect(screen.getByText("US$39")).toBeInTheDocument();
    expect(screen.getByText("one-time")).toBeInTheDocument();
    expect(screen.getByText("Full PMLE access for 90 days")).toBeInTheDocument();
    expect(screen.getByText("No subscription. No automatic renewal.")).toBeInTheDocument();
  });

  it("does not present retired tiers, savings or billing intervals", () => {
    const { container } = render(<PricingCard onCheckout={jest.fn()} />);
    expect(container.textContent).not.toMatch(/monthly|\/month|three.month|\bPro\b|All-Access|trial|save \d+%/i);
    expect(container.firstElementChild?.className).not.toMatch(/(^|\s)scale-/);
  });

  it("lists full access features and refund revocation clearly", () => {
    render(<PricingCard onCheckout={jest.fn()} />);
    for (const feature of PMLE_PASS_FEATURES) expect(screen.getByText(feature)).toBeInTheDocument();
    expect(screen.getByText("7-day refund window. A refund ends your pass access.")).toBeInTheDocument();
  });

  it("starts checkout without accepting public Stripe configuration", async () => {
    const onCheckout = jest.fn();
    render(<PricingCard onCheckout={onCheckout} />);
    await userEvent.click(screen.getByRole("button", { name: "Get PMLE Pass" }));
    expect(onCheckout).toHaveBeenCalledTimes(1);
    expect(onCheckout).toHaveBeenCalledWith();
  });

  it("enables purchase without a public price ID", () => {
    render(<PricingCard onCheckout={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Get PMLE Pass" })).toBeEnabled();
    expect(screen.queryByText(/payment processing is being set up/i)).not.toBeInTheDocument();
  });

  it("disables purchase while checkout is loading", async () => {
    const onCheckout = jest.fn();
    render(<PricingCard onCheckout={onCheckout} loading />);
    const button = screen.getByRole("button", { name: /get pmle pass/i });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onCheckout).not.toHaveBeenCalled();
  });
});
