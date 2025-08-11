import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, jest } from "@jest/globals";
import { GradientButton } from "@/components/ui/gradient-button";
import { component as colorComponent } from "@/lib/design-system/tokens/colors";

describe("GradientButton Component", () => {
  describe("Rendering", () => {
    test("renders with text content", () => {
      render(<GradientButton>Get Started</GradientButton>);
      expect(screen.getByText("Get Started")).toBeInTheDocument();
    });

    test("renders as a button by default", () => {
      render(<GradientButton>Click Me</GradientButton>);
      const button = screen.getByText("Click Me");
      expect(button.tagName).toBe("BUTTON");
    });

    test("renders as a link when href is provided", () => {
      render(<GradientButton href="/signup">Sign Up</GradientButton>);
      const link = screen.getByText("Sign Up");
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "/signup");
    });

    test("renders with custom className", () => {
      render(<GradientButton className="custom-class">Custom</GradientButton>);
      const button = screen.getByText("Custom");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("Gradient Variants", () => {
    test("hero variant uses hero gradient from design tokens", () => {
      render(<GradientButton variant="hero">Hero Button</GradientButton>);
      const button = screen.getByText("Hero Button");

      // Should use the gradient-hero background
      expect(button).toHaveClass("bg-gradient-hero");
      expect(button).toHaveClass("text-white");
    });

    test("cta variant uses CTA gradient from design tokens", () => {
      render(<GradientButton variant="cta">CTA Button</GradientButton>);
      const button = screen.getByText("CTA Button");

      // Should use the gradient-cta background
      expect(button).toHaveClass("bg-gradient-cta");
      expect(button).toHaveClass("text-white");
    });

    test("badge variant uses badge gradient from design tokens", () => {
      render(<GradientButton variant="badge">Badge Button</GradientButton>);
      const button = screen.getByText("Badge Button");

      // Should use the gradient-badge background
      expect(button).toHaveClass("bg-gradient-badge");
      expect(button).toHaveClass("text-white");
    });

    test("primary variant uses primary solid color", () => {
      render(<GradientButton variant="primary">Primary Button</GradientButton>);
      const button = screen.getByText("Primary Button");

      // Should use solid primary color, not gradient
      expect(button).toHaveClass("bg-blue-600");
      expect(button).toHaveClass("hover:bg-blue-700");
      expect(button).toHaveClass("text-white");
    });

    test("secondary variant uses secondary styles", () => {
      render(<GradientButton variant="secondary">Secondary Button</GradientButton>);
      const button = screen.getByText("Secondary Button");

      // Should use secondary styles with border
      expect(button).toHaveClass("bg-white");
      expect(button).toHaveClass("border-2");
      expect(button).toHaveClass("border-blue-600");
      expect(button).toHaveClass("text-blue-600");
    });
  });

  describe("Size Variants", () => {
    test("renders small size", () => {
      render(<GradientButton size="sm">Small</GradientButton>);
      const button = screen.getByText("Small");
      expect(button).toHaveClass("text-sm");
      expect(button).toHaveClass("px-4");
      expect(button).toHaveClass("py-2");
    });

    test("renders default/medium size", () => {
      render(<GradientButton>Medium</GradientButton>);
      const button = screen.getByText("Medium");
      expect(button).toHaveClass("text-base");
      expect(button).toHaveClass("px-6");
      expect(button).toHaveClass("py-3");
    });

    test("renders large size", () => {
      render(<GradientButton size="lg">Large</GradientButton>);
      const button = screen.getByText("Large");
      expect(button).toHaveClass("text-lg");
      expect(button).toHaveClass("px-8");
      expect(button).toHaveClass("py-4");
    });

    test("renders extra large size", () => {
      render(<GradientButton size="xl">Extra Large</GradientButton>);
      const button = screen.getByText("Extra Large");
      expect(button).toHaveClass("text-xl");
      expect(button).toHaveClass("px-10");
      expect(button).toHaveClass("py-5");
    });
  });

  describe("Interactive States", () => {
    test("handles click events", () => {
      const handleClick = jest.fn();
      render(<GradientButton onClick={handleClick}>Click Me</GradientButton>);

      const button = screen.getByText("Click Me");
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test("can be disabled", () => {
      const handleClick = jest.fn();
      render(
        <GradientButton disabled onClick={handleClick}>
          Disabled
        </GradientButton>
      );

      const button = screen.getByText("Disabled");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("opacity-50");
      expect(button).toHaveClass("cursor-not-allowed");

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    test("shows loading state", () => {
      render(<GradientButton loading>Loading</GradientButton>);

      const button = screen.getByText("Loading");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("opacity-75");

      // Should show loading spinner
      const spinner = button.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    test("supports full width", () => {
      render(<GradientButton fullWidth>Full Width</GradientButton>);
      const button = screen.getByText("Full Width");
      expect(button).toHaveClass("w-full");
    });
  });

  describe("Style Consistency", () => {
    test("applies consistent border radius", () => {
      render(<GradientButton>Rounded</GradientButton>);
      const button = screen.getByText("Rounded");
      expect(button).toHaveClass("rounded-lg");
    });

    test("applies consistent font weight", () => {
      render(<GradientButton>Font Weight</GradientButton>);
      const button = screen.getByText("Font Weight");
      expect(button).toHaveClass("font-semibold");
    });

    test("has transition effects", () => {
      render(<GradientButton>Transitions</GradientButton>);
      const button = screen.getByText("Transitions");
      expect(button).toHaveClass("transition-all");
      expect(button).toHaveClass("duration-200");
    });

    test("has shadow on hover for gradient variants", () => {
      render(<GradientButton variant="hero">Shadow Hover</GradientButton>);
      const button = screen.getByText("Shadow Hover");
      expect(button).toHaveClass("hover:shadow-lg");
    });
  });

  describe("Accessibility", () => {
    test("supports aria-label", () => {
      render(<GradientButton aria-label="Start your journey">Start</GradientButton>);
      const button = screen.getByLabelText("Start your journey");
      expect(button).toBeInTheDocument();
    });

    test("has proper button role", () => {
      render(<GradientButton>Action</GradientButton>);
      const button = screen.getByRole("button", { name: "Action" });
      expect(button).toBeInTheDocument();
    });

    test("link variant has proper link role", () => {
      render(<GradientButton href="/start">Start</GradientButton>);
      const link = screen.getByRole("link", { name: "Start" });
      expect(link).toBeInTheDocument();
    });

    test("disabled state is properly communicated", () => {
      render(<GradientButton disabled>Disabled</GradientButton>);
      const button = screen.getByRole("button", { name: "Disabled" });
      expect(button).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("Icon Support", () => {
    test("renders with left icon", () => {
      const Icon = () => <span data-testid="left-icon">→</span>;
      render(<GradientButton leftIcon={<Icon />}>With Icon</GradientButton>);

      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
      expect(screen.getByText("With Icon")).toBeInTheDocument();
    });

    test("renders with right icon", () => {
      const Icon = () => <span data-testid="right-icon">→</span>;
      render(<GradientButton rightIcon={<Icon />}>With Icon</GradientButton>);

      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
      expect(screen.getByText("With Icon")).toBeInTheDocument();
    });

    test("icon spacing adjusts with size", () => {
      const Icon = () => <span data-testid="icon">→</span>;
      render(
        <GradientButton size="sm" leftIcon={<Icon />}>
          Small with Icon
        </GradientButton>
      );

      const button = screen.getByRole("button", { name: /Small with Icon/i });
      expect(button).toHaveClass("gap-2"); // Small gap for small size
    });
  });

  describe("Design Token Validation", () => {
    test("gradient definitions use correct token values", () => {
      // Verify the gradient tokens are defined in the design system
      expect(colorComponent.button).toBeDefined();
      expect(colorComponent.button.gradient).toBeDefined();
      expect(colorComponent.button.gradient.hero).toBeDefined();
      expect(colorComponent.button.gradient.cta).toBeDefined();
      expect(colorComponent.button.gradient.badge).toBeDefined();
    });

    test("button colors use semantic tokens", () => {
      // Verify button colors reference semantic tokens
      expect(colorComponent.button.primary).toBeDefined();
      expect(colorComponent.button.primary.bg).toBeDefined();
      expect(colorComponent.button.primary.text).toBeDefined();
      expect(colorComponent.button.primary.hover).toBeDefined();
    });
  });
});
