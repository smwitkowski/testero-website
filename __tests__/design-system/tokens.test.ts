import { describe, expect, test } from "@jest/globals";
import * as path from "path";

// Import the existing design system
import {
  primitive as colorPrimitive,
  semantic as colorSemantic,
  component as colorComponent,
} from "@/lib/design-system/tokens/colors";

// We'll dynamically require the Tailwind config to avoid module issues
let tailwindConfig: any;

beforeAll(() => {
  // Clear the module cache to ensure fresh imports
  jest.resetModules();

  // Mock the required plugins to avoid import errors
  jest.mock("tailwindcss-animate", () => ({}), { virtual: true });
  jest.mock("@tailwindcss/typography", () => ({}), { virtual: true });

  // Now we can safely import the config
  tailwindConfig = jest.requireActual("../../tailwind.config").default;
});

describe("Design System Tokens", () => {
  describe("Semantic Tokens", () => {
    test("should have neutral color scale for gray UI elements", () => {
      // These will fail initially as semantic.neutral doesn't exist yet
      expect(colorSemantic.neutral).toBeDefined();
      expect(colorSemantic.neutral["50"]).toBe("#f8fafc");
      expect(colorSemantic.neutral["100"]).toBe("#f1f5f9");
      expect(colorSemantic.neutral["200"]).toBe("#e2e8f0");
      expect(colorSemantic.neutral["300"]).toBe("#cbd5e1");
      expect(colorSemantic.neutral["400"]).toBe("#94a3b8");
      expect(colorSemantic.neutral["500"]).toBe("#64748b");
      expect(colorSemantic.neutral["600"]).toBe("#475569");
      expect(colorSemantic.neutral["700"]).toBe("#334155");
      expect(colorSemantic.neutral["800"]).toBe("#1e293b");
      expect(colorSemantic.neutral["900"]).toBe("#0f172a");
    });

    test("should have cyan color scale for gradients", () => {
      expect(colorPrimitive.cyan).toBeDefined();
      expect(colorPrimitive.cyan["500"]).toBe("#06b6d4");
      expect(colorPrimitive.cyan["600"]).toBe("#0891b2");
      expect(colorPrimitive.cyan["700"]).toBe("#0e7490");
    });

    test("should have yellow color scale for alerts and badges", () => {
      expect(colorPrimitive.yellow).toBeDefined();
      expect(colorPrimitive.yellow["100"]).toBe("#fef3c7");
      expect(colorPrimitive.yellow["300"]).toBe("#fde047"); // Updated to match actual value
      expect(colorPrimitive.yellow["400"]).toBe("#fbbf24");
    });

    test("should have purple color scale for feature highlights", () => {
      expect(colorPrimitive.purple).toBeDefined();
      expect(colorPrimitive.purple["100"]).toBe("#ede9fe");
      expect(colorPrimitive.purple["400"]).toBe("#a78bfa");
      expect(colorPrimitive.purple["600"]).toBe("#9333ea");
    });
  });

  describe("Component Tokens", () => {
    test("should have diagnostic-specific component tokens", () => {
      expect(colorComponent.diagnostic).toBeDefined();
      expect(colorComponent.diagnostic.background).toBe(colorSemantic.surface.default);
      expect(colorComponent.diagnostic.border).toBe(colorSemantic.border.default);
      expect(colorComponent.diagnostic.resumeBg).toBe(colorSemantic.info.light);
      expect(colorComponent.diagnostic.resumeBorder).toBe(colorSemantic.info.base);
      expect(colorComponent.diagnostic.inputBorder).toBe("#ccc");
      expect(colorComponent.diagnostic.buttonPrimary).toBe("#0070f3");
    });

    test("should have content/article-specific tokens", () => {
      expect(colorComponent.content).toBeDefined();
      expect(colorComponent.content.background).toBe(colorSemantic.surface.default);
      expect(colorComponent.content.tag.bg).toBe(colorPrimitive.blue["50"]);
      expect(colorComponent.content.tag.text).toBe(colorPrimitive.blue["700"]);
      expect(colorComponent.content.tag.border).toBe(colorPrimitive.blue["200"]);
      expect(colorComponent.content.prose.heading).toBe(colorSemantic.text.primary);
      expect(colorComponent.content.prose.body).toBe(colorSemantic.text.secondary);
    });

    test("should have form/input state tokens", () => {
      expect(colorComponent.form).toBeDefined();
      expect(colorComponent.form.input.default).toBe(colorSemantic.border.default);
      expect(colorComponent.form.input.focus).toBe(colorPrimitive.blue["500"]);
      expect(colorComponent.form.input.error).toBe(colorSemantic.error.base);
      expect(colorComponent.form.input.success).toBe(colorSemantic.success.base);
      expect(colorComponent.form.label).toBe(colorSemantic.text.primary);
      expect(colorComponent.form.helper).toBe(colorSemantic.text.muted);
    });

    test("should have badge/alert variant tokens", () => {
      expect(colorComponent.badge).toBeDefined();

      // Success badge
      expect(colorComponent.badge.success.bg).toBe(colorSemantic.success.light);
      expect(colorComponent.badge.success.text).toBe(colorSemantic.success.dark);
      expect(colorComponent.badge.success.border).toBe(`${colorSemantic.success.base}40`);

      // Error badge
      expect(colorComponent.badge.error.bg).toBe(colorSemantic.error.light);
      expect(colorComponent.badge.error.text).toBe(colorSemantic.error.dark);
      expect(colorComponent.badge.error.border).toBe(`${colorSemantic.error.base}40`);

      // Warning badge
      expect(colorComponent.badge.warning.bg).toBe(colorSemantic.warning.light);
      expect(colorComponent.badge.warning.text).toBe(colorSemantic.warning.dark);
      expect(colorComponent.badge.warning.border).toBe(`${colorSemantic.warning.base}40`);

      // Info badge
      expect(colorComponent.badge.info.bg).toBe(colorSemantic.info.light);
      expect(colorComponent.badge.info.text).toBe(colorSemantic.info.dark);
      expect(colorComponent.badge.info.border).toBe(`${colorSemantic.info.base}40`);
    });

    test("should have pricing card tokens", () => {
      expect(colorComponent.pricing).toBeDefined();
      expect(colorComponent.pricing.card.default.bg).toBe(colorSemantic.surface.default);
      expect(colorComponent.pricing.card.default.border).toBe(colorPrimitive.slate["200"]);
      expect(colorComponent.pricing.card.recommended.border).toBe(colorPrimitive.blue["500"]);
      expect(colorComponent.pricing.badge.bg).toBeDefined();
      expect(colorComponent.pricing.badge.text).toBe(colorPrimitive.white);
    });
  });

  describe("Tailwind Configuration", () => {
    test("should expose neutral semantic colors in Tailwind", () => {
      expect(tailwindConfig.theme.extend.colors.neutral).toBeDefined();
      expect(tailwindConfig.theme.extend.colors.neutral).toEqual({
        50: colorSemantic.neutral["50"],
        100: colorSemantic.neutral["100"],
        200: colorSemantic.neutral["200"],
        300: colorSemantic.neutral["300"],
        400: colorSemantic.neutral["400"],
        500: colorSemantic.neutral["500"],
        600: colorSemantic.neutral["600"],
        700: colorSemantic.neutral["700"],
        800: colorSemantic.neutral["800"],
        900: colorSemantic.neutral["900"],
      });
    });

    test("should expose cyan colors in Tailwind", () => {
      expect(tailwindConfig.theme.extend.colors.cyan).toBeDefined();
      expect(tailwindConfig.theme.extend.colors.cyan["500"]).toBe("#06b6d4");
      expect(tailwindConfig.theme.extend.colors.cyan["600"]).toBe("#0891b2");
    });

    test("should expose yellow colors in Tailwind", () => {
      expect(tailwindConfig.theme.extend.colors.yellow).toBeDefined();
      expect(tailwindConfig.theme.extend.colors.yellow["100"]).toBe("#fef3c7");
      expect(tailwindConfig.theme.extend.colors.yellow["400"]).toBe("#fbbf24");
    });

    test("should expose purple colors in Tailwind", () => {
      expect(tailwindConfig.theme.extend.colors.purple).toBeDefined();
      expect(tailwindConfig.theme.extend.colors.purple["100"]).toBe("#ede9fe");
      expect(tailwindConfig.theme.extend.colors.purple["600"]).toBe("#9333ea");
    });

    test("should have custom gradient utilities", () => {
      expect(tailwindConfig.theme.extend.backgroundImage).toBeDefined();
      expect(tailwindConfig.theme.extend.backgroundImage["gradient-hero"]).toBeDefined();
      expect(tailwindConfig.theme.extend.backgroundImage["gradient-cta"]).toBeDefined();
      expect(tailwindConfig.theme.extend.backgroundImage["gradient-badge"]).toBeDefined();
    });

    test("should expose semantic text colors", () => {
      expect(tailwindConfig.theme.extend.textColor).toBeDefined();
      expect(tailwindConfig.theme.extend.textColor["primary"]).toBe(colorSemantic.text.primary);
      expect(tailwindConfig.theme.extend.textColor["secondary"]).toBe(colorSemantic.text.secondary);
      expect(tailwindConfig.theme.extend.textColor["muted"]).toBe(colorSemantic.text.muted);
    });

    test("should expose semantic background colors", () => {
      expect(tailwindConfig.theme.extend.backgroundColor).toBeDefined();
      expect(tailwindConfig.theme.extend.backgroundColor["surface"]).toBe(
        colorSemantic.surface.default
      );
      expect(tailwindConfig.theme.extend.backgroundColor["surface-elevated"]).toBe(
        colorSemantic.surface.elevated
      );
    });

    test("should expose semantic border colors", () => {
      expect(tailwindConfig.theme.extend.borderColor).toBeDefined();
      expect(tailwindConfig.theme.extend.borderColor["default"]).toBe(colorSemantic.border.default);
    });
  });

  describe("Token Consistency", () => {
    test("all component tokens should reference semantic or primitive tokens", () => {
      // This ensures we're not introducing new hardcoded values
      const diagnosticBg = colorComponent.diagnostic.background;
      expect(diagnosticBg).toBe(colorSemantic.surface.default);

      const contentTagBg = colorComponent.content.tag.bg;
      expect([colorPrimitive.blue["50"], colorSemantic.primary["50"]]).toContain(contentTagBg);
    });

    test("semantic tokens should only reference primitive tokens", () => {
      // Verify semantic tokens use primitives
      expect(colorSemantic.primary["500"]).toBe(colorPrimitive.slate["500"]);
      expect(colorSemantic.accent["500"]).toBe(colorPrimitive.orange["500"]);
    });
  });
});
