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
    threeMonthPrice: 135,
    monthlyPriceId: "price_monthly_pro",
    threeMonthPriceId: "price_3month_pro",
    features: ["Feature A", "Feature B"],
  } as const;

  it("applies emphasis styling for the recommended tier", () => {
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
    expect(card.className).toContain("ring-2");
  });

  it("adds extra padding when three-month savings badge is present", () => {
    const { container } = render(
      <PricingCard
        tier={{ ...baseTier, savingsPercentage: 20 }}
        billingInterval="three_month"
        onCheckout={jest.fn()}
      />
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("pt-6");
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

      const button = screen.getByRole("button", { name: /start preparing/i });
      expect(button).toBeEnabled();
    });

    it("should enable button when three-month price ID is present", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={baseTier}
          billingInterval="three_month"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /start preparing/i });
      expect(button).toBeEnabled();
    });

    it("should show Get Started button when monthly price ID is missing", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={{ ...baseTier, monthlyPriceId: undefined }}
          billingInterval="monthly"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeEnabled();
      // When checkout isn't configured, button redirects to signup instead of calling onCheckout
    });

    it("should show Get Started button when three-month price ID is missing", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={{ ...baseTier, threeMonthPriceId: undefined }}
          billingInterval="three_month"
          onCheckout={onCheckout}
        />
      );

      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeEnabled();
      // When checkout isn't configured, button redirects to signup instead of calling onCheckout
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

      const button = screen.getByRole("button", { name: /start preparing/i });
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

      const button = screen.getByRole("button", { name: /start preparing/i });
      expect(button).toBeDisabled();
    });

    it("should show Get Started button when price ID is missing (redirects to signup instead of calling onCheckout)", async () => {
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
      expect(button).toBeEnabled();

      await user.click(button);

      // When checkout isn't configured, onCheckout should not be called
      // (component redirects to signup instead via router.push)
      expect(onCheckout).not.toHaveBeenCalled();
    });
  });
});
