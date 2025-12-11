import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  describe("Button enabled/disabled states", () => {
    it("should enable button when monthly price ID is present", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={baseTier}
          billingInterval="monthly"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("data-checkout-configured", "true");
    });

    it("should enable button when annual price ID is present", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={baseTier}
          billingInterval="annual"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("data-checkout-configured", "true");
    });

    it("should disable button when monthly price ID is missing", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={{ ...baseTier, monthlyPriceId: undefined }}
          billingInterval="monthly"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("data-checkout-configured", "false");
    });

    it("should disable button when annual price ID is missing", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={{ ...baseTier, annualPriceId: undefined }}
          billingInterval="annual"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("data-checkout-configured", "false");
    });

    it("should call onCheckout with correct price ID when button is clicked", async () => {
      const user = userEvent.setup();
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={baseTier}
          billingInterval="monthly"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      await user.click(button);

      expect(onCheckout).toHaveBeenCalledTimes(1);
      expect(onCheckout).toHaveBeenCalledWith("price_monthly_pro", "Pro");
    });

    it("should disable button when loading", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={baseTier}
          billingInterval="monthly"
          onCheckout={onCheckout}
          loading={true}
          loadingId="price_monthly_pro"
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeDisabled();
    });

    it("should not call onCheckout when button is disabled due to missing price ID", async () => {
      const user = userEvent.setup();
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={{ ...baseTier, monthlyPriceId: undefined }}
          billingInterval="monthly"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeDisabled();

      // Attempt to click disabled button (should not trigger handler)
      await user.click(button).catch(() => {
        // Expected to fail when button is disabled
      });

      expect(onCheckout).not.toHaveBeenCalled();
    });
  });
});
