import { describe, expect, test } from "@jest/globals";
import {
  diagnosticColorMap,
  diagnosticContainerStyles,
  diagnosticButtonStyles,
  diagnosticInputStyles,
  diagnosticTextStyles,
  diagnosticTailwindClasses,
  getDiagnosticStyles,
  migrateInlineStyles,
} from "@/lib/design-system/utils/diagnostic-styles";
import { component, semantic, primitive } from "@/lib/design-system/tokens/colors";

describe("Diagnostic Style Utilities", () => {
  describe("Color Mapping", () => {
    test("maps old hex colors to design tokens", () => {
      expect(diagnosticColorMap["#eee"]).toBe(semantic.border.default);
      expect(diagnosticColorMap["#f0f8ff"]).toBe(component.diagnostic.resumeBg);
      expect(diagnosticColorMap["#0070f3"]).toBe(component.diagnostic.buttonPrimary);
      expect(diagnosticColorMap["#666"]).toBe(semantic.text.secondary);
      expect(diagnosticColorMap["#ccc"]).toBe(component.diagnostic.inputBorder);
      expect(diagnosticColorMap["#d32f2f"]).toBe(component.diagnostic.errorText);
      expect(diagnosticColorMap["#fff"]).toBe(primitive.white);
    });

    test("color map values match expected token values", () => {
      // Verify that mapped values match the actual token values
      expect(diagnosticColorMap["#eee"]).toBe(semantic.border.default);
      expect(diagnosticColorMap["#0070f3"]).toBe(component.diagnostic.buttonPrimary);

      // These values should come from the design system
      Object.entries(diagnosticColorMap).forEach(([oldColor, tokenValue]) => {
        expect(tokenValue).toBeDefined();

        // Special cases where token value happens to match the old hardcoded value
        const specialCases = ["#0070f3", "#ccc"]; // These are defined in tokens with same values

        if (!specialCases.includes(oldColor)) {
          // For most colors, the token value should be different from the old hardcoded value
          expect(tokenValue).not.toBe(oldColor);
        }
      });
    });
  });

  describe("Container Styles", () => {
    test("main container has proper layout", () => {
      expect(diagnosticContainerStyles.main.maxWidth).toBe(800);
      expect(diagnosticContainerStyles.main.margin).toBe("0 auto");
      expect(diagnosticContainerStyles.main.padding).toBe(20);
    });

    test("card styles use design tokens", () => {
      const card = diagnosticContainerStyles.card;
      expect(card.border).toContain(semantic.border.default);
      expect(card.backgroundColor).toBe(component.diagnostic.background);
      expect(card.padding).toBe(20);
      expect(card.borderRadius).toBe(8);
    });

    test("error card uses error tokens", () => {
      const errorCard = diagnosticContainerStyles.errorCard;
      expect(errorCard.border).toContain(component.diagnostic.errorBorder);
      expect(errorCard.backgroundColor).toBe(component.diagnostic.errorBg);
    });

    test("resume card uses info tokens", () => {
      const resumeCard = diagnosticContainerStyles.resumeCard;
      expect(resumeCard.backgroundColor).toBe(component.diagnostic.resumeBg);
      expect(resumeCard.border).toContain(component.diagnostic.resumeBorder);
    });
  });

  describe("Button Styles", () => {
    test("primary button uses design tokens", () => {
      const primary = diagnosticButtonStyles.primary;
      expect(primary.background).toBe(component.diagnostic.buttonPrimary);
      expect(primary.color).toBe(primitive.white);
      expect(primary.padding).toBe("12px 24px");
      expect(primary.borderRadius).toBe(6);
      expect(primary.cursor).toBe("pointer");
    });

    test("secondary button uses semantic tokens", () => {
      const secondary = diagnosticButtonStyles.secondary;
      expect(secondary.background).toBe(primitive.white);
      expect(secondary.color).toBe(semantic.text.secondary);
      expect(secondary.border).toContain(semantic.border.default);
    });

    test("disabled button uses neutral tokens", () => {
      const disabled = diagnosticButtonStyles.disabled;
      expect(disabled.background).toBe(semantic.neutral["300"]);
      expect(disabled.color).toBe(semantic.neutral["500"]);
      expect(disabled.cursor).toBe("not-allowed");
      expect(disabled.opacity).toBe(0.6);
    });
  });

  describe("Input Styles", () => {
    test("default input uses design tokens", () => {
      const defaultInput = diagnosticInputStyles.default;
      expect(defaultInput.border).toContain(component.diagnostic.inputBorder);
      expect(defaultInput.width).toBe("100%");
      expect(defaultInput.padding).toBe(8);
      expect(defaultInput.borderRadius).toBe(4);
    });

    test("error input uses error tokens", () => {
      const errorInput = diagnosticInputStyles.error;
      expect(errorInput.border).toContain(component.diagnostic.errorBorder);
    });

    test("focus state uses form tokens", () => {
      const focusInput = diagnosticInputStyles.focus;
      expect(focusInput.borderColor).toBe(component.form.input.focus);
      expect(focusInput.outline).toBe("none");
    });
  });

  describe("Text Styles", () => {
    test("title uses semantic text tokens", () => {
      const title = diagnosticTextStyles.title;
      expect(title.color).toBe(semantic.text.primary);
      expect(title.fontSize).toBe(24);
      expect(title.fontWeight).toBe("bold");
    });

    test("body text uses secondary color", () => {
      const body = diagnosticTextStyles.body;
      expect(body.color).toBe(semantic.text.secondary);
      expect(body.lineHeight).toBe(1.6);
    });

    test("error text uses error tokens", () => {
      const error = diagnosticTextStyles.error;
      expect(error.color).toBe(component.diagnostic.errorText);
    });

    test("muted text uses muted tokens", () => {
      const muted = diagnosticTextStyles.muted;
      expect(muted.color).toBe(semantic.text.muted);
      expect(muted.fontSize).toBe(12);
    });

    test("resume title uses info tokens", () => {
      const resumeTitle = diagnosticTextStyles.resumeTitle;
      expect(resumeTitle.color).toBe(component.diagnostic.resumeBorder);
    });
  });

  describe("Tailwind Classes", () => {
    test("container classes use standard spacing", () => {
      expect(diagnosticTailwindClasses.container).toContain("max-w-3xl");
      expect(diagnosticTailwindClasses.container).toContain("mx-auto");
      expect(diagnosticTailwindClasses.container).toContain("p-5");
    });

    test("card classes use neutral colors", () => {
      expect(diagnosticTailwindClasses.card).toContain("border-neutral-200");
      expect(diagnosticTailwindClasses.card).toContain("bg-white");
    });

    test("error card uses error tokens", () => {
      expect(diagnosticTailwindClasses.errorCard).toContain("border-error");
      expect(diagnosticTailwindClasses.errorCard).toContain("bg-error-light");
    });

    test("resume card uses info tokens", () => {
      expect(diagnosticTailwindClasses.resumeCard).toContain("bg-info-light");
      expect(diagnosticTailwindClasses.resumeCard).toContain("border-info");
    });

    test("button classes include hover states", () => {
      expect(diagnosticTailwindClasses.primaryButton).toContain("hover:bg-blue-700");
      expect(diagnosticTailwindClasses.secondaryButton).toContain("hover:bg-neutral-50");
    });

    test("input classes include focus states", () => {
      expect(diagnosticTailwindClasses.input).toContain("focus:border-blue-500");
      expect(diagnosticTailwindClasses.input).toContain("focus:ring-2");
      expect(diagnosticTailwindClasses.inputError).toContain("focus:border-error");
    });

    test("text classes use semantic colors", () => {
      expect(diagnosticTailwindClasses.title).toContain("text-primary");
      expect(diagnosticTailwindClasses.body).toContain("text-secondary");
      expect(diagnosticTailwindClasses.errorText).toContain("text-error-dark");
      expect(diagnosticTailwindClasses.mutedText).toContain("text-muted");
    });
  });

  describe("getDiagnosticStyles Helper", () => {
    test("returns Tailwind classes when useTailwind is true", () => {
      const styles = getDiagnosticStyles(true);
      expect(styles).toEqual(diagnosticTailwindClasses);
    });

    test("returns style objects when useTailwind is false", () => {
      const styles = getDiagnosticStyles(false);
      expect(styles.container).toEqual(diagnosticContainerStyles);
      expect(styles.button).toEqual(diagnosticButtonStyles);
      expect(styles.input).toEqual(diagnosticInputStyles);
      expect(styles.text).toEqual(diagnosticTextStyles);
    });

    test("defaults to style objects when no parameter", () => {
      const styles = getDiagnosticStyles();
      expect(styles.container).toBeDefined();
      expect(styles.button).toBeDefined();
      expect(styles.input).toBeDefined();
      expect(styles.text).toBeDefined();
    });
  });

  describe("migrateInlineStyles Function", () => {
    test("replaces hardcoded colors with design tokens", () => {
      const oldStyle = {
        backgroundColor: "#f0f8ff",
        border: "1px solid #eee",
        color: "#666",
      };

      const newStyle = migrateInlineStyles(oldStyle);

      expect(newStyle.backgroundColor).toBe(component.diagnostic.resumeBg);
      expect(newStyle.border).toContain(semantic.border.default);
      expect(newStyle.color).toBe(semantic.text.secondary);
    });

    test("preserves non-color properties", () => {
      const oldStyle = {
        padding: 20,
        margin: "0 auto",
        fontSize: 14,
        backgroundColor: "#fff",
      };

      const newStyle = migrateInlineStyles(oldStyle);

      expect(newStyle.padding).toBe(20);
      expect(newStyle.margin).toBe("0 auto");
      expect(newStyle.fontSize).toBe(14);
      expect(newStyle.backgroundColor).toBe(primitive.white);
    });

    test("handles multiple color replacements in same property", () => {
      const oldStyle = {
        boxShadow: "0 2px 4px #ccc",
        border: "2px solid #0070f3",
      };

      const newStyle = migrateInlineStyles(oldStyle);

      expect(newStyle.boxShadow).toContain(component.diagnostic.inputBorder);
      expect(newStyle.border).toContain(component.diagnostic.buttonPrimary);
    });

    test("returns new object without mutating original", () => {
      const oldStyle = {
        color: "#666",
      };

      const newStyle = migrateInlineStyles(oldStyle);

      expect(newStyle).not.toBe(oldStyle);
      expect(oldStyle.color).toBe("#666");
      expect(newStyle.color).toBe(semantic.text.secondary);
    });
  });

  describe("Style Consistency", () => {
    test("all styles use consistent token values", () => {
      // Verify styles use token values (which resolve to actual colors)
      expect(diagnosticContainerStyles.card.backgroundColor).toBe(component.diagnostic.background);
      expect(diagnosticContainerStyles.errorCard.backgroundColor).toBe(
        component.diagnostic.errorBg
      );
      expect(diagnosticButtonStyles.primary.background).toBe(component.diagnostic.buttonPrimary);
      expect(diagnosticTextStyles.error.color).toBe(component.diagnostic.errorText);

      // Verify no inline hex colors in Tailwind classes (these should use utility classes)
      const tailwindString = JSON.stringify(diagnosticTailwindClasses);
      expect(tailwindString).not.toMatch(/#[0-9a-fA-F]{6}/);
    });

    test("transition properties are consistent", () => {
      expect(diagnosticButtonStyles.primary.transition).toBe("all 0.2s");
      expect(diagnosticButtonStyles.secondary.transition).toBe("all 0.2s");
      expect(diagnosticInputStyles.default.transition).toBe("border-color 0.2s");
    });

    test("border radius values are consistent", () => {
      expect(diagnosticContainerStyles.card.borderRadius).toBe(8);
      expect(diagnosticContainerStyles.errorCard.borderRadius).toBe(8);
      expect(diagnosticContainerStyles.resumeCard.borderRadius).toBe(8);
      expect(diagnosticButtonStyles.primary.borderRadius).toBe(6);
      expect(diagnosticInputStyles.default.borderRadius).toBe(4);
    });
  });
});
