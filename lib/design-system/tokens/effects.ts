// Design System: Effects Tokens
// This file defines shadows, gradients, and visual effects for Testero

// PRIMITIVE TOKENS (Base effect values)
export const primitive = {
  // Box shadows
  boxShadow: {
    none: 'none',
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },

  // Drop shadows (for text and icons)
  dropShadow: {
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
    md: '0 4px 3px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 8px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 13px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 25px rgba(0, 0, 0, 0.15)',
  },

  // Blur effects
  blur: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '16px',
    xl: '24px',
    '2xl': '40px',
    '3xl': '64px',
  },

  // Opacity values
  opacity: {
    0: '0',
    5: '0.05',
    10: '0.1',
    20: '0.2',
    25: '0.25',
    30: '0.3',
    40: '0.4',
    50: '0.5',
    60: '0.6',
    70: '0.7',
    75: '0.75',
    80: '0.8',
    90: '0.9',
    95: '0.95',
    100: '1',
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
  },
};

// SEMANTIC TOKENS (Purpose-based effects)
export const semantic = {
  // Shadow hierarchy
  elevation: {
    flat: primitive.boxShadow.none,
    low: primitive.boxShadow.sm,
    medium: primitive.boxShadow.md,
    high: primitive.boxShadow.lg,
    highest: primitive.boxShadow.xl,
    modal: primitive.boxShadow['2xl'],
  },

  // Focus states
  focus: {
    ring: '0 0 0 2px rgba(59, 130, 246, 0.5)', // Blue ring
    outline: '2px solid transparent',
    offset: '2px',
  },

  // Backdrop effects
  backdrop: {
    none: 'none',
    blur: `blur(${primitive.blur.md})`,
    blurHeavy: `blur(${primitive.blur.lg})`,
    overlay: `blur(${primitive.blur.sm})`,
  },

  // Glass morphism effects
  glass: {
    light: {
      background: `rgba(255, 255, 255, ${primitive.opacity[20]})`,
      backdropFilter: `blur(${primitive.blur.md})`,
      border: `1px solid rgba(255, 255, 255, ${primitive.opacity[30]})`,
    },
    dark: {
      background: `rgba(0, 0, 0, ${primitive.opacity[20]})`,
      backdropFilter: `blur(${primitive.blur.md})`,
      border: `1px solid rgba(255, 255, 255, ${primitive.opacity[10]})`,
    },
  },
};

// COMPONENT TOKENS (Context-specific effects)
export const component = {
  // Hero section effects
  hero: {
    spotlight: {
      // Primary spotlight effect
      primary: {
        background: `radial-gradient(circle at center, rgba(249, 115, 22, ${primitive.opacity[40]}) 0%, transparent 70%)`,
        filter: `blur(${primitive.blur['3xl']})`,
        opacity: primitive.opacity[60],
      },
      // Secondary spotlight
      secondary: {
        background: `radial-gradient(circle at center, rgba(239, 68, 68, ${primitive.opacity[30]}) 0%, transparent 70%)`,
        filter: `blur(${primitive.blur['3xl']})`,
        opacity: primitive.opacity[30],
      },
      // Accent spotlight
      accent: {
        background: `radial-gradient(circle at center, rgba(251, 146, 60, ${primitive.opacity[30]}) 0%, transparent 70%)`,
        filter: `blur(${primitive.blur['3xl']})`,
        opacity: primitive.opacity[30],
      },
    },
    gradient: {
      // Main hero background
      background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      // Text gradient for accent text
      text: 'linear-gradient(45deg, #fb923c, #ef4444)',
      // Subtle overlay
      overlay: `linear-gradient(180deg, rgba(0, 0, 0, ${primitive.opacity[10]}) 0%, rgba(0, 0, 0, ${primitive.opacity[30]}) 100%)`,
    },
  },

  // Button effects
  button: {
    primary: {
      shadow: semantic.elevation.low,
      shadowHover: semantic.elevation.medium,
      gradient: 'linear-gradient(45deg, #f97316, #ea580c)',
      gradientHover: 'linear-gradient(45deg, #ea580c, #c2410c)',
    },
    secondary: {
      shadow: semantic.elevation.low,
      shadowHover: semantic.elevation.medium,
      border: `1px solid rgba(255, 255, 255, ${primitive.opacity[40]})`,
    },
    ghost: {
      shadow: primitive.boxShadow.none,
      shadowHover: semantic.elevation.low,
      background: `rgba(255, 255, 255, ${primitive.opacity[10]})`,
      backgroundHover: `rgba(255, 255, 255, ${primitive.opacity[20]})`,
    },
  },

  // Card effects
  card: {
    default: {
      shadow: semantic.elevation.low,
      shadowHover: semantic.elevation.medium,
      border: `1px solid rgba(226, 232, 240, ${primitive.opacity[100]})`, // slate-200
      borderRadius: primitive.borderRadius.lg,
    },
    elevated: {
      shadow: semantic.elevation.medium,
      shadowHover: semantic.elevation.high,
      border: `1px solid rgba(241, 245, 249, ${primitive.opacity[100]})`, // slate-100
      borderRadius: primitive.borderRadius.xl,
    },
    glass: {
      ...semantic.glass.light,
      shadow: semantic.elevation.low,
      shadowHover: semantic.elevation.medium,
      borderRadius: primitive.borderRadius.lg,
    },
  },

  // Social proof effects
  socialProof: {
    card: {
      shadow: primitive.boxShadow.md,
      shadowHover: primitive.boxShadow.lg,
      borderRadius: primitive.borderRadius.lg,
      transform: 'translateY(0)',
      transformHover: 'translateY(-4px)',
    },
    marquee: {
      mask: 'linear-gradient(90deg, transparent 0%, white 10%, white 90%, transparent 100%)',
    },
  },

  // Trust indicators
  trust: {
    badge: {
      shadow: primitive.boxShadow.sm,
      borderRadius: primitive.borderRadius.md,
      glow: `0 0 20px rgba(34, 197, 94, ${primitive.opacity[20]})`, // Green glow
    },
    logo: {
      shadow: primitive.boxShadow.none,
      shadowHover: primitive.boxShadow.sm,
      borderRadius: primitive.borderRadius.md,
      opacity: primitive.opacity[80],
      opacityHover: primitive.opacity[100],
    },
  },

  // Navigation effects
  nav: {
    shadow: primitive.boxShadow.sm,
    backdrop: `blur(${primitive.blur.md})`,
    background: `rgba(255, 255, 255, ${primitive.opacity[90]})`,
    border: `1px solid rgba(226, 232, 240, ${primitive.opacity[50]})`,
  },

  // Modal and overlay effects
  modal: {
    backdrop: `rgba(0, 0, 0, ${primitive.opacity[50]})`,
    shadow: semantic.elevation.modal,
    borderRadius: primitive.borderRadius['2xl'],
  },

  // Loading and state effects
  loading: {
    spinner: {
      animation: 'spin 1s linear infinite',
    },
    skeleton: {
      background: `linear-gradient(90deg, rgba(226, 232, 240, ${primitive.opacity[100]}) 25%, rgba(241, 245, 249, ${primitive.opacity[100]}) 50%, rgba(226, 232, 240, ${primitive.opacity[100]}) 75%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    },
    pulse: {
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    },
  },
};

// GRADIENT PRESETS
export const gradients = {
  // Brand gradients
  brand: {
    primary: 'linear-gradient(45deg, #f97316, #ea580c)',
    secondary: 'linear-gradient(45deg, #fb923c, #ef4444)',
    subtle: 'linear-gradient(180deg, #fff7ed, #ffedd5)',
  },

  // Background gradients
  background: {
    hero: component.hero.gradient.background,
    light: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
    dark: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
  },

  // Trust and cloud provider gradients
  cloud: {
    google: 'linear-gradient(45deg, #eff6ff, #dbeafe)',
    aws: 'linear-gradient(45deg, #fff7ed, #ffedd5)',
    azure: 'linear-gradient(45deg, #eff6ff, #e0e7ff)',
  },

  // State gradients
  state: {
    success: 'linear-gradient(45deg, #dcfce7, #bbf7d0)',
    warning: 'linear-gradient(45deg, #fef3c7, #fde68a)',
    error: 'linear-gradient(45deg, #fee2e2, #fecaca)',
    info: 'linear-gradient(45deg, #dbeafe, #bfdbfe)',
  },
};

// ANIMATION KEYFRAMES
export const keyframes = {
  // Shimmer effect for loading states
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },

  // Spotlight animation
  spotlight: {
    '0%': { opacity: '0.3', transform: 'scale(0.8)' },
    '50%': { opacity: '0.6', transform: 'scale(1)' },
    '100%': { opacity: '0.3', transform: 'scale(0.8)' },
  },

  // Float animation
  float: {
    '0%, 100%': { transform: 'translateY(0px)' },
    '50%': { transform: 'translateY(-10px)' },
  },

  // Glow pulse
  glowPulse: {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0.5' },
  },
};

// RESPONSIVE EFFECTS
export const responsive = {
  // Responsive shadow patterns
  shadows: {
    card: {
      mobile: semantic.elevation.low,
      tablet: semantic.elevation.medium,
      desktop: semantic.elevation.medium,
    },
    hero: {
      mobile: primitive.boxShadow.none,
      tablet: semantic.elevation.low,
      desktop: semantic.elevation.medium,
    },
  },

  // Responsive blur patterns
  blur: {
    backdrop: {
      mobile: primitive.blur.sm,
      tablet: primitive.blur.md,
      desktop: primitive.blur.lg,
    },
  },
};

// Legacy compatibility
export const effects = {
  boxShadow: primitive.boxShadow,
  dropShadow: primitive.dropShadow,
  blur: primitive.blur,
  borderRadius: primitive.borderRadius,
  gradients,
  elevation: semantic.elevation,
};