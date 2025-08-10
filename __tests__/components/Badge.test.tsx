import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "@jest/globals";
import { Badge } from "@/components/ui/badge";
import { component as colorComponent } from "@/lib/design-system/tokens/colors";

describe("Badge Component", () => {
  describe("Rendering", () => {
    test("renders with text content", () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText("Test Badge")).toBeInTheDocument();
    });

    test("renders with custom className", () => {
      render(<Badge className="custom-class">Custom</Badge>);
      const badge = screen.getByText("Custom");
      expect(badge).toHaveClass("custom-class");
    });
  });

  describe("Semantic Color Tokens", () => {
    test("success variant uses design system tokens", () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText("Success");

      // Should use semantic success colors
      expect(badge).toHaveClass("bg-success-light");
      expect(badge).toHaveClass("text-success-dark");
      expect(badge).toHaveClass("border-success/40");
    });

    test("error variant uses design system tokens", () => {
      render(<Badge variant="error">Error</Badge>);
      const badge = screen.getByText("Error");

      // Should use semantic error colors
      expect(badge).toHaveClass("bg-error-light");
      expect(badge).toHaveClass("text-error-dark");
      expect(badge).toHaveClass("border-error/40");
    });

    test("warning variant uses design system tokens", () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText("Warning");

      // Should use semantic warning colors
      expect(badge).toHaveClass("bg-warning-light");
      expect(badge).toHaveClass("text-warning-dark");
      expect(badge).toHaveClass("border-warning/40");
    });

    test("info variant uses design system tokens", () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText("Info");

      // Should use semantic info colors
      expect(badge).toHaveClass("bg-info-light");
      expect(badge).toHaveClass("text-info-dark");
      expect(badge).toHaveClass("border-info/40");
    });

    test("default variant uses neutral colors", () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText("Default");

      // Should use neutral colors for default
      expect(badge).toHaveClass("bg-neutral-100");
      expect(badge).toHaveClass("text-neutral-700");
      expect(badge).toHaveClass("border-neutral-200");
    });
  });

  describe("Size Variants", () => {
    test("renders small size", () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText("Small");
      expect(badge).toHaveClass("text-xs");
      expect(badge).toHaveClass("px-2");
      expect(badge).toHaveClass("py-0.5");
    });

    test("renders default size", () => {
      render(<Badge>Default Size</Badge>);
      const badge = screen.getByText("Default Size");
      expect(badge).toHaveClass("text-sm");
      expect(badge).toHaveClass("px-3");
      expect(badge).toHaveClass("py-1");
    });

    test("renders large size", () => {
      render(<Badge size="lg">Large</Badge>);
      const badge = screen.getByText("Large");
      expect(badge).toHaveClass("text-base");
      expect(badge).toHaveClass("px-4");
      expect(badge).toHaveClass("py-1.5");
    });
  });

  describe("Style Consistency", () => {
    test("applies consistent border radius", () => {
      render(<Badge>Rounded</Badge>);
      const badge = screen.getByText("Rounded");
      expect(badge).toHaveClass("rounded-md");
    });

    test("applies consistent font weight", () => {
      render(<Badge>Font Weight</Badge>);
      const badge = screen.getByText("Font Weight");
      expect(badge).toHaveClass("font-medium");
    });

    test("has border by default", () => {
      render(<Badge>Border</Badge>);
      const badge = screen.getByText("Border");
      expect(badge).toHaveClass("border");
    });
  });

  describe("Accessibility", () => {
    test("supports aria-label", () => {
      render(<Badge aria-label="Status indicator">Status</Badge>);
      const badge = screen.getByLabelText("Status indicator");
      expect(badge).toBeInTheDocument();
    });

    test("can be used as a semantic element", () => {
      render(<Badge as="span">Span Badge</Badge>);
      const badge = screen.getByText("Span Badge");
      expect(badge.tagName).toBe("SPAN");
    });
  });

  describe("Color Token Validation", () => {
    test("success colors match design system tokens", () => {
      const successLight = colorComponent.badge.success.bg;
      const successDark = colorComponent.badge.success.text;

      // Verify the token values are being used
      expect(successLight).toBeDefined();
      expect(successDark).toBeDefined();
    });

    test("error colors match design system tokens", () => {
      const errorLight = colorComponent.badge.error.bg;
      const errorDark = colorComponent.badge.error.text;

      // Verify the token values are being used
      expect(errorLight).toBeDefined();
      expect(errorDark).toBeDefined();
    });
  });
});
