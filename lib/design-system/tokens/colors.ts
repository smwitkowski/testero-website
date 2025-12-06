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

  // Brand colors (Testero identity)
  brand: {
    teal: {
      DEFAULT: "#1D9C91",
      light: "#2BB8AC",    // Lighter variant for hover
      dark: "#167A71",     // Darker variant for active
    },
    navy: {
      DEFAULT: "#0E1A33",
      light: "#1A2D4D",    // Lighter variant
      dark: "#070D1A",     // Darker variant
    },
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
    50: "#E6F7F5",    // Light teal tints
    100: "#CCEFEB",
    200: "#99DFD7",
    300: "#66CFC3",
    400: "#33BFAF",
    500: primitive.brand.teal.DEFAULT,   // #1D9C91 - Brand teal
    600: "#177D74",
    700: "#125E57",
    800: "#0C3E3A",
    900: "#061F1D",
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

  // Brand colors
  brand: {
    primary: "#1D9C91",      // Teal
    secondary: "#0E1A33",    // Navy
    primaryForeground: "#FFFFFF",
    secondaryForeground: "#FFFFFF",
  },
};

// COMPONENT TOKENS (Context-specific)
export const component = {
  // Hero section
  hero: {
    background: {
      // Dark gradient for hero sections using navy
      dark: `linear-gradient(180deg, ${primitive.brand.navy.DEFAULT} 0%, ${primitive.brand.navy.dark} 50%, ${primitive.brand.navy.DEFAULT} 100%)`,
      light: `linear-gradient(180deg, ${primitive.slate[50]} 0%, ${primitive.slate[100]} 100%)`,
    },
    text: {
      primary: primitive.white,
      secondary: `${primitive.white}90`, // 90% opacity
      accent: `linear-gradient(45deg, ${primitive.brand.teal.light}, ${primitive.brand.teal.DEFAULT})`,
    },
    spotlight: {
      primary: `${primitive.brand.teal.DEFAULT}40`, // 40% opacity
      secondary: `${primitive.brand.teal.light}30`, // 30% opacity
      accent: `${primitive.brand.teal.DEFAULT}30`, // 30% opacity
    },
  },

  // Button variants
  button: {
    // Gradient variants for GradientButton component
    gradient: {
      hero: `linear-gradient(135deg, ${primitive.brand.teal.DEFAULT} 0%, ${primitive.brand.teal.light} 100%)`,
      cta: `linear-gradient(45deg, ${primitive.brand.teal.DEFAULT} 0%, ${primitive.brand.teal.dark} 100%)`,
      badge: `linear-gradient(90deg, ${primitive.brand.teal.DEFAULT} 0%, ${primitive.brand.teal.light} 100%)`,
    },
    // Solid color variants
    primary: {
      bg: primitive.brand.teal.DEFAULT,
      text: primitive.white,
      hover: primitive.brand.teal.dark,
      focus: primitive.brand.teal.dark,
      background: `linear-gradient(45deg, ${primitive.brand.teal.DEFAULT}, ${primitive.brand.teal.light})`,
      backgroundHover: `linear-gradient(45deg, ${primitive.brand.teal.dark}, ${primitive.brand.teal.DEFAULT})`,
      border: primitive.transparent,
    },
    secondary: {
      bg: primitive.white,
      text: primitive.brand.teal.DEFAULT,
      border: primitive.brand.teal.DEFAULT,
      hover: semantic.accent[50],
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
      accent: primitive.brand.teal.DEFAULT, // For icons
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
    buttonPrimary: primitive.brand.teal.DEFAULT,
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
      bg: `${primitive.brand.teal.DEFAULT}10`,
      text: primitive.brand.teal.dark,
      border: primitive.brand.teal.light,
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
      focus: primitive.brand.teal.DEFAULT,
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
        border: primitive.brand.teal.DEFAULT,
      },
    },
    badge: {
      bg: `linear-gradient(45deg, ${primitive.brand.teal.DEFAULT}, ${primitive.brand.teal.light})`,
      text: primitive.white,
    },
  },

  // Dashboard-specific tokens
  dashboard: {
    sidebar: {
      background: primitive.white,
      activeItem: primitive.brand.teal.DEFAULT,
      activeItemBg: `${primitive.brand.teal.DEFAULT}10`,
      hoverBg: primitive.slate[50],
    },
    blueprintTable: {
      masteredBg: `${semantic.success.base}10`,
      practiceBg: `${primitive.brand.teal.DEFAULT}10`,
    },
    topBar: {
      background: primitive.white,
      border: primitive.slate[200],
      height: "56px",
    },
    userDropdown: {
      avatarBg: primitive.slate[100],
      avatarText: primitive.slate[600],
      menuBg: primitive.white,
      menuBorder: primitive.slate[200],
      menuShadow: "rgba(0, 0, 0, 0.1)",
      itemHover: primitive.slate[50],
      itemText: primitive.slate[700],
      itemIcon: primitive.slate[500],
      divider: primitive.slate[200],
    },
    sidebarOverlay: {
      backdrop: "rgba(0, 0, 0, 0.5)",
      width: "280px",
    },
    examContext: {
      background: primitive.slate[50],
      text: primitive.slate[700],
      label: primitive.slate[500],
      border: primitive.slate[200],
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
