// Design System: Diagnostic Page Style Utilities
// This module provides style objects using design system tokens for the diagnostic pages

import { component, semantic, primitive } from "../tokens/colors";

/**
 * Maps old hardcoded colors to design system tokens
 * This helps in refactoring existing inline styles
 */
export const diagnosticColorMap = {
  // Old hex values -> New token references
  "#eee": semantic.border.default,
  "#f0f8ff": component.diagnostic.resumeBg,
  "#0070f3": component.diagnostic.buttonPrimary,
  "#666": semantic.text.secondary,
  "#ccc": component.diagnostic.inputBorder,
  "#d32f2f": component.diagnostic.errorText,
  "#fff": primitive.white,
} as const;

/**
 * Container styles for diagnostic pages
 */
export const diagnosticContainerStyles = {
  main: {
    maxWidth: 800,
    margin: "0 auto",
    padding: 20,
  },
  card: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 8,
    border: `1px solid ${semantic.border.default}`,
    backgroundColor: component.diagnostic.background,
  },
  errorCard: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 8,
    border: `1px solid ${component.diagnostic.errorBorder}`,
    backgroundColor: component.diagnostic.errorBg,
  },
  resumeCard: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: component.diagnostic.resumeBg,
    border: `1px solid ${component.diagnostic.resumeBorder}`,
  },
} as const;

/**
 * Button styles using design tokens
 */
export const diagnosticButtonStyles = {
  primary: {
    padding: "12px 24px",
    borderRadius: 6,
    border: "none",
    background: component.diagnostic.buttonPrimary,
    color: primitive.white,
    fontSize: 16,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  secondary: {
    padding: "12px 24px",
    borderRadius: 6,
    background: primitive.white,
    color: semantic.text.secondary,
    border: `1px solid ${semantic.border.default}`,
    fontSize: 16,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  disabled: {
    padding: "12px 24px",
    borderRadius: 6,
    border: "none",
    background: semantic.neutral["300"],
    color: semantic.neutral["500"],
    fontSize: 16,
    cursor: "not-allowed",
    opacity: 0.6,
  },
} as const;

/**
 * Form input styles
 */
export const diagnosticInputStyles = {
  default: {
    width: "100%",
    padding: 8,
    borderRadius: 4,
    border: `1px solid ${component.diagnostic.inputBorder}`,
    fontSize: 14,
    transition: "border-color 0.2s",
  },
  error: {
    width: "100%",
    padding: 8,
    borderRadius: 4,
    border: `1px solid ${component.diagnostic.errorBorder}`,
    fontSize: 14,
  },
  focus: {
    borderColor: component.form.input.focus,
    outline: "none",
  },
} as const;

/**
 * Text styles
 */
export const diagnosticTextStyles = {
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: semantic.text.primary,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    color: semantic.text.primary,
  },
  body: {
    fontSize: 14,
    lineHeight: 1.6,
    color: semantic.text.secondary,
  },
  error: {
    color: component.diagnostic.errorText,
    marginBottom: 16,
  },
  muted: {
    color: semantic.text.muted,
    fontSize: 12,
  },
  resumeTitle: {
    margin: "0 0 1rem 0",
    color: component.diagnostic.resumeBorder,
  },
} as const;

/**
 * Tailwind class mappings for diagnostic pages
 * These use the semantic classes we've exposed in Tailwind config
 */
export const diagnosticTailwindClasses = {
  container: "max-w-3xl mx-auto p-5",
  card: "p-5 mb-5 rounded-lg border border-neutral-200 bg-white",
  errorCard: "p-5 mb-5 rounded-lg border border-error bg-error-light",
  resumeCard: "p-5 mb-5 rounded-lg bg-info-light border border-info",

  // Buttons
  primaryButton:
    "px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors",
  secondaryButton:
    "px-6 py-3 rounded-md bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 font-medium transition-colors",
  disabledButton:
    "px-6 py-3 rounded-md bg-neutral-300 text-neutral-500 cursor-not-allowed opacity-60",

  // Text
  title: "text-2xl font-bold mb-4 text-primary",
  subtitle: "text-xl font-semibold mb-3 text-primary",
  body: "text-sm leading-relaxed text-secondary",
  errorText: "text-error-dark mb-4",
  mutedText: "text-muted text-xs",

  // Form elements
  input:
    "w-full px-2 py-2 rounded border border-neutral-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
  inputError:
    "w-full px-2 py-2 rounded border border-error focus:border-error focus:outline-none focus:ring-2 focus:ring-error/20",
  label: "block mb-2 text-sm font-medium text-primary",
  helperText: "mt-1 text-xs text-muted",
} as const;

/**
 * Helper function to get style object or Tailwind classes based on preference
 */
export function getDiagnosticStyles(useTailwind: boolean = false) {
  if (useTailwind) {
    return diagnosticTailwindClasses;
  }

  return {
    container: diagnosticContainerStyles,
    button: diagnosticButtonStyles,
    input: diagnosticInputStyles,
    text: diagnosticTextStyles,
  };
}

/**
 * Converts old inline styles to use design tokens
 */
export function migrateInlineStyles(oldStyle: Record<string, any>): Record<string, any> {
  const newStyle = { ...oldStyle };

  // Replace hardcoded colors with tokens
  Object.entries(diagnosticColorMap).forEach(([oldColor, newToken]) => {
    Object.keys(newStyle).forEach((key) => {
      if (typeof newStyle[key] === "string" && newStyle[key].includes(oldColor)) {
        newStyle[key] = newStyle[key].replace(oldColor, newToken);
      }
    });
  });

  return newStyle;
}
