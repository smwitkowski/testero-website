// Design System: Color Tokens
// This file defines the complete color system for Testero
// Following W3C Design Tokens specification: primitive → semantic → component

// PRIMITIVE TOKENS (Raw color values)
export const primitive = {
  // Slate scale (primary brand colors)
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },

  // Orange scale (accent colors)
  orange: {
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
  },

  // Red scale (for gradients and accents)
  red: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },

  // Green scale (success states)
  green: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },

  // Blue scale (info and trust)
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },

  // Indigo scale (for Azure branding)
  indigo: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
  },

  // Cyan scale (for gradients and CTAs)
  cyan: {
    50: "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
    800: "#155e75",
    900: "#164e63",
  },

  // Yellow scale (for alerts and badges)
  yellow: {
    50: "#fefce8",
    100: "#fef3c7",
    200: "#fef08a",
    300: "#fde047",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },

  // Purple scale (for feature highlights)
  purple: {
    50: "#faf5ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#9333ea",
    700: "#6b21a8",
    800: "#581c87",
    900: "#3b0764",
  },

  // Pure colors
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

// SEMANTIC TOKENS (Purpose-based)
export const semantic = {
  // Brand colors
  primary: {
    50: primitive.slate[50],
    100: primitive.slate[100],
    200: primitive.slate[200],
    300: primitive.slate[300],
    400: primitive.slate[400],
    500: primitive.slate[500],
    600: primitive.slate[600],
    700: primitive.slate[700],
    800: primitive.slate[800],
    900: primitive.slate[900],
  },

  accent: {
    50: primitive.orange[50],
    100: primitive.orange[100],
    200: primitive.orange[200],
    300: primitive.orange[300],
    400: primitive.orange[400],
    500: primitive.orange[500],
    600: primitive.orange[600],
    700: primitive.orange[700],
    800: primitive.orange[800],
    900: primitive.orange[900],
  },

  // Neutral colors (for gray UI elements)
  neutral: {
    50: primitive.slate[50],
    100: primitive.slate[100],
    200: primitive.slate[200],
    300: primitive.slate[300],
    400: primitive.slate[400],
    500: primitive.slate[500],
    600: primitive.slate[600],
    700: primitive.slate[700],
    800: primitive.slate[800],
    900: primitive.slate[900],
  },

  // Feedback colors
  success: {
    light: primitive.green[100],
    base: primitive.green[500],
    dark: primitive.green[800],
  },
  error: {
    light: primitive.red[100],
    base: primitive.red[500],
    dark: primitive.red[800],
  },
  warning: {
    light: "#fef3c7",
    base: "#f59e0b",
    dark: "#92400e",
  },
  info: {
    light: primitive.blue[100],
    base: primitive.blue[500],
    dark: primitive.blue[800],
  },

  // Surface colors
  background: {
    default: primitive.slate[50],
    dark: primitive.slate[900],
    darkSecondary: primitive.slate[800],
  },
  surface: {
    default: primitive.white,
    elevated: primitive.white,
    dark: primitive.slate[800],
  },
  border: {
    default: primitive.slate[200],
    dark: primitive.slate[700],
  },

  // Text colors
  text: {
    primary: primitive.slate[800],
    secondary: primitive.slate[600],
    muted: primitive.slate[400],
    inverse: primitive.white,
    accent: primitive.orange[500],
  },
};

// COMPONENT TOKENS (Context-specific)
export const component = {
  // Hero section
  hero: {
    background: {
      // Dark gradient for hero sections
      dark: `linear-gradient(180deg, ${primitive.slate[900]} 0%, ${primitive.slate[800]} 50%, ${primitive.slate[900]} 100%)`,
      light: `linear-gradient(180deg, ${primitive.slate[50]} 0%, ${primitive.slate[100]} 100%)`,
    },
    text: {
      primary: primitive.white,
      secondary: `${primitive.white}90`, // 90% opacity
      accent: `linear-gradient(45deg, ${primitive.orange[400]}, ${primitive.red[500]})`,
    },
    spotlight: {
      primary: `${primitive.orange[500]}40`, // 40% opacity
      secondary: `${primitive.red[500]}30`, // 30% opacity
      accent: `${primitive.orange[400]}30`, // 30% opacity
    },
  },

  // Button variants
  button: {
    // Gradient variants for GradientButton component
    gradient: {
      hero: `linear-gradient(135deg, ${primitive.blue[600]} 0%, ${primitive.cyan[600]} 100%)`,
      cta: `linear-gradient(45deg, ${primitive.orange[500]} 0%, ${primitive.red[500]} 100%)`,
      badge: `linear-gradient(90deg, ${primitive.blue[600]} 0%, ${primitive.cyan[600]} 100%)`,
    },
    // Solid color variants
    primary: {
      bg: primitive.blue[600],
      text: primitive.white,
      hover: primitive.blue[700],
      focus: primitive.blue[800],
      background: `linear-gradient(45deg, ${primitive.orange[500]}, ${primitive.orange[600]})`,
      backgroundHover: `linear-gradient(45deg, ${primitive.orange[600]}, ${primitive.orange[700]})`,
      border: primitive.transparent,
    },
    secondary: {
      bg: primitive.white,
      text: primitive.blue[600],
      border: primitive.blue[600],
      hover: primitive.blue[50],
      background: primitive.white,
      backgroundHover: primitive.slate[50],
    },
    ghost: {
      background: primitive.transparent,
      backgroundHover: `${primitive.white}20`, // 20% opacity
      text: primitive.white,
      border: `${primitive.white}40`, // 40% opacity
    },
    outline: {
      background: primitive.transparent,
      backgroundHover: primitive.slate[50],
      text: primitive.slate[800],
      border: primitive.slate[300],
    },
    disabled: {
      bg: primitive.slate[100],
      text: primitive.slate[400],
      opacity: 0.5,
    },
  },

  // Card variants
  card: {
    default: {
      background: primitive.white,
      border: primitive.slate[200],
      shadow: "rgba(0, 0, 0, 0.1)",
    },
    elevated: {
      background: primitive.white,
      border: primitive.slate[100],
      shadow: "rgba(0, 0, 0, 0.15)",
    },
    glass: {
      background: `${primitive.white}20`, // 20% opacity
      border: `${primitive.white}30`, // 30% opacity
      backdrop: "blur(8px)",
    },
  },

  // Social proof elements
  socialProof: {
    badge: {
      background: primitive.white,
      border: primitive.slate[100],
      text: primitive.slate[800],
      accent: primitive.blue[600], // For icons
    },
    marquee: {
      background: primitive.slate[50],
    },
  },

  // Trust indicators
  trust: {
    logo: {
      googleCloud: `linear-gradient(45deg, ${primitive.blue[100]}, ${primitive.blue[200]})`,
      aws: `linear-gradient(45deg, ${primitive.orange[100]}, ${primitive.orange[200]})`,
      azure: `linear-gradient(45deg, ${primitive.blue[100]}, ${primitive.indigo[200]})`,
    },
    badge: {
      success: `${primitive.green[500]}20`, // 20% opacity
      text: primitive.white,
      border: `${primitive.green[400]}40`, // 40% opacity
    },
  },

  // Diagnostic page specific tokens
  diagnostic: {
    background: semantic.surface.default,
    border: semantic.border.default,
    resumeBg: semantic.info.light,
    resumeBorder: semantic.info.base,
    inputBorder: "#ccc",
    buttonPrimary: "#0070f3",
    // Error states
    errorText: semantic.error.dark,
    errorBg: semantic.error.light,
    errorBorder: semantic.error.base,
    // Success states
    successText: semantic.success.dark,
    successBg: semantic.success.light,
    successBorder: semantic.success.base,
    // Loading states
    loadingBg: semantic.neutral["100"],
    loadingText: semantic.neutral["600"],
    loadingBorder: semantic.neutral["300"],
    // Additional UI states
    mutedText: semantic.text.muted,
    secondaryText: semantic.text.secondary,
    cardBg: semantic.surface.default,
    cardBorder: semantic.border.default,
  },

  // Content/article specific tokens
  content: {
    background: semantic.surface.default,
    tag: {
      bg: primitive.blue[50],
      text: primitive.blue[700],
      border: primitive.blue[200],
    },
    prose: {
      heading: semantic.text.primary,
      body: semantic.text.secondary,
    },
  },

  // Form/input state tokens
  form: {
    input: {
      default: semantic.border.default,
      focus: primitive.blue[500],
      error: semantic.error.base,
      success: semantic.success.base,
    },
    label: semantic.text.primary,
    helper: semantic.text.muted,
  },

  // Badge/alert variant tokens
  badge: {
    success: {
      bg: semantic.success.light,
      text: semantic.success.dark,
      border: `${semantic.success.base}40`,
    },
    error: {
      bg: semantic.error.light,
      text: semantic.error.dark,
      border: `${semantic.error.base}40`,
    },
    warning: {
      bg: semantic.warning.light,
      text: semantic.warning.dark,
      border: `${semantic.warning.base}40`,
    },
    info: {
      bg: semantic.info.light,
      text: semantic.info.dark,
      border: `${semantic.info.base}40`,
    },
  },

  // Pricing card tokens
  pricing: {
    card: {
      default: {
        bg: semantic.surface.default,
        border: primitive.slate[200],
      },
      recommended: {
        border: primitive.blue[500],
      },
    },
    badge: {
      bg: `linear-gradient(45deg, ${primitive.blue[600]}, ${primitive.cyan[600]})`,
      text: primitive.white,
    },
  },

  // Dashboard-specific tokens
  dashboard: {
    sidebar: {
      background: primitive.white,
      activeItem: semantic.accent[500],
      activeItemBg: `${semantic.accent[500]}10`,
      hoverBg: primitive.slate[50],
    },
    blueprintTable: {
      masteredBg: `${semantic.success.base}10`,
      practiceBg: `${semantic.accent[500]}10`,
    },
  },
};

// Legacy compatibility (for existing components)
export const colors = {
  primary: semantic.primary,
  accent: semantic.accent,
  feedback: {
    success: semantic.success,
    error: semantic.error,
    warning: semantic.warning,
    info: semantic.info,
  },
  ui: {
    white: primitive.white,
    black: primitive.black,
    background: semantic.background,
    card: semantic.surface,
    border: semantic.border,
  },
};

// Color usage guidelines (updated)
export const colorUsage = {
  pageBackground: semantic.background.default,
  text: semantic.text,
  button: component.button,
  card: component.card.default,
  hero: component.hero,
};
