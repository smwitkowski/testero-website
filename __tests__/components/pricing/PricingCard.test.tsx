import React from "react";
import { render } from "@testing-library/react";
import { PricingCard } from "@/components/pricing/PricingCard";

describe("PricingCard", () => {
  const baseTier = {
    id: "pro",
    name: "Pro",
    description: "For teams that need more",
    monthlyPrice: 49,
    annualPrice: 490,
    monthlyPriceId: "price_monthly_pro",
    annualPriceId: "price_annual_pro",
    aiCredits: 250,
    features: ["Feature A", "Feature B"],
  } as const;

  it("applies non-scaling emphasis on mobile for the recommended tier", () => {
    const { container } = render(
      <PricingCard
        tier={{ ...baseTier, recommended: true, savingsPercentage: 25 }}
        billingInterval="monthly"
        onCheckout={jest.fn()}
      />
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card).toBeTruthy();
    expect(card).toHaveAttribute("data-recommended", "true");
    expect(card.className).toContain("md:motion-safe:scale-105");
    expect(card.className).toContain("ring-2");
    expect(card.className).not.toMatch(/(^|\s)scale-[^:\s]+/);
  });

  it("adds extra padding when annual savings badge is present", () => {
    const { container } = render(
      <PricingCard
        tier={{ ...baseTier, savingsPercentage: 20 }}
        billingInterval="annual"
        onCheckout={jest.fn()}
      />
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("pt-12");
    expect(card.className).not.toMatch(/(^|\s)scale-[^:\s]+/);
  });
});
