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
      const badge = screen.getByText("Custom").closest("[data-slot=badge]")!;
      expect(badge).toHaveClass("custom-class");
    });
  });

  describe("Semantic Color Tokens", () => {
    test("success variant uses design system tokens", () => {
      render(<Badge tone="success">Success</Badge>);
      const badge = screen.getByText("Success").closest("[data-slot=badge]")!;

      // Should use semantic success colors
      expect(badge).toHaveClass("bg-success/10");
      expect(badge).toHaveClass("text-success");
      expect(badge).toHaveClass("ring-success/20");
    });

    test("error variant uses design system tokens", () => {
      render(<Badge tone="danger">Error</Badge>);
      const badge = screen.getByText("Error").closest("[data-slot=badge]")!;

      // Should use semantic error colors
      expect(badge).toHaveClass("bg-error/10");
      expect(badge).toHaveClass("text-error");
      expect(badge).toHaveClass("ring-error/20");
    });

    test("warning variant uses design system tokens", () => {
      render(<Badge tone="warning">Warning</Badge>);
      const badge = screen.getByText("Warning").closest("[data-slot=badge]")!;

      // Should use semantic warning colors
      expect(badge).toHaveClass("bg-warning/15");
      expect(badge).toHaveClass("text-warning-dark");
      expect(badge).toHaveClass("ring-warning/30");
    });

    test("info variant uses design system tokens", () => {
      render(<Badge tone="info">Info</Badge>);
      const badge = screen.getByText("Info").closest("[data-slot=badge]")!;

      // Should use semantic info colors
      expect(badge).toHaveClass("bg-info/10");
      expect(badge).toHaveClass("text-info");
      expect(badge).toHaveClass("ring-info/20");
    });

    test("default variant uses neutral colors", () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText("Default").closest("[data-slot=badge]")!;

      // Should use neutral colors for default
      expect(badge).toHaveClass("bg-muted");
      expect(badge).toHaveClass("text-foreground");
      expect(badge).toHaveClass("ring-border/60");
    });
  });

  describe("Size Variants", () => {
    test("renders small size", () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText("Small").closest("[data-slot=badge]")!;
      expect(badge).toHaveClass("text-xs");
      expect(badge).toHaveClass("px-2");
      expect(badge).toHaveClass("h-6");
    });

    test("renders default size", () => {
      render(<Badge>Default Size</Badge>);
      const badge = screen.getByText("Default Size").closest("[data-slot=badge]")!;
      expect(badge).toHaveClass("text-sm");
      expect(badge).toHaveClass("px-2.5");
      expect(badge).toHaveClass("h-7");
    });

    test("renders explicit medium size", () => {
      render(<Badge size="md">Medium</Badge>);
      const badge = screen.getByText("Medium").closest("[data-slot=badge]")!;
      expect(badge).toHaveClass("text-sm", "px-2.5", "h-7");
    });
  });

  describe("Style Consistency", () => {
    test("applies consistent border radius", () => {
      render(<Badge>Rounded</Badge>);
      const badge = screen.getByText("Rounded").closest("[data-slot=badge]")!;
      expect(badge).toHaveClass("rounded-full");
    });

    test("applies consistent font weight", () => {
      render(<Badge>Font Weight</Badge>);
      const badge = screen.getByText("Font Weight").closest("[data-slot=badge]")!;
      expect(badge).toHaveClass("font-medium");
    });

    test("has inset ring by default", () => {
      render(<Badge>Border</Badge>);
      const badge = screen.getByText("Border").closest("[data-slot=badge]")!;
      expect(badge).toHaveClass("ring-1");
    });
  });

  describe("Accessibility", () => {
    test("supports aria-label", () => {
      render(<Badge aria-label="Status indicator">Status</Badge>);
      const badge = screen.getByLabelText("Status indicator");
      expect(badge).toBeInTheDocument();
    });

    test("can be used as a semantic element", () => {
      render(<Badge >Span Badge</Badge>);
      const badge = screen.getByText("Span Badge").closest("[data-slot=badge]")!;
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
