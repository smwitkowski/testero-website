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

  it("adds extra padding when annual savings badge is present", () => {
    const { container } = render(
      <PricingCard
        tier={{ ...baseTier, savingsPercentage: 20 }}
        billingInterval="annual"
        onCheckout={jest.fn()}
      />
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("pt-6");
    expect(card.className).not.toMatch(/(^|\s)scale-[^:\s]+/);
  });

  it("displays monthly average as primary price when annual billing is selected", () => {
    render(
      <PricingCard
        tier={baseTier}
        billingInterval="annual"
        onCheckout={jest.fn()}
      />
    );

    // Annual mode should show monthly average (490/12 = 40.83, rounded to 41)
    expect(screen.getByText(/\$41/)).toBeInTheDocument();
    // Should show "/month" as the unit
    expect(screen.getByText(/\/month/)).toBeInTheDocument();
    // Should show annual billing info as secondary text
    expect(screen.getByText(/Billed annually at \$490\/year/)).toBeInTheDocument();
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

    it("should enable button when annual price ID is present", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={baseTier}
          billingInterval="annual"
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

    it("should show Get Started button when annual price ID is missing", () => {
      const onCheckout = jest.fn();
      render(
        <PricingCard
          tier={{ ...baseTier, annualPriceId: undefined }}
          billingInterval="annual"
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
