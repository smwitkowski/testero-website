// Design System: Typography Tokens
// This file defines the typography scale and text patterns for Testero

// PRIMITIVE TOKENS (Base font values)
export const primitive = {
  // Font families
  fontFamily: {
    sans: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Oxygen',
      'Ubuntu',
      'Cantarell',
      'Fira Sans',
      'Droid Sans',
      'Helvetica Neue',
      'sans-serif',
    ],
    mono: [
      'Consolas',
      'Monaco',
      'Courier New',
      'monospace',
    ],
  },

  // Font weights
  fontWeight: {
    thin: '100',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },

  // Font sizes (using rem for accessibility)
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem',  // 60px
    '7xl': '4.5rem',   // 72px
  },

  // Line heights
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

// SEMANTIC TOKENS (Purpose-based typography)
export const semantic = {
  // Text sizes by purpose
  text: {
    caption: {
      fontSize: primitive.fontSize.xs,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.normal,
    },
    body: {
      fontSize: primitive.fontSize.base,
      lineHeight: primitive.lineHeight.relaxed,
      fontWeight: primitive.fontWeight.normal,
    },
    bodyLarge: {
      fontSize: primitive.fontSize.lg,
      lineHeight: primitive.lineHeight.relaxed,
      fontWeight: primitive.fontWeight.normal,
    },
    label: {
      fontSize: primitive.fontSize.sm,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.medium,
    },
    button: {
      fontSize: primitive.fontSize.base,
      lineHeight: primitive.lineHeight.none,
      fontWeight: primitive.fontWeight.semibold,
    },
  },

  // Heading hierarchy
  heading: {
    h1: {
      fontSize: primitive.fontSize['7xl'],
      lineHeight: primitive.lineHeight.tight,
      fontWeight: primitive.fontWeight.extrabold,
      letterSpacing: primitive.letterSpacing.tight,
    },
    h2: {
      fontSize: primitive.fontSize['4xl'],
      lineHeight: primitive.lineHeight.tight,
      fontWeight: primitive.fontWeight.bold,
      letterSpacing: primitive.letterSpacing.tight,
    },
    h3: {
      fontSize: primitive.fontSize['3xl'],
      lineHeight: primitive.lineHeight.snug,
      fontWeight: primitive.fontWeight.bold,
      letterSpacing: primitive.letterSpacing.normal,
    },
    h4: {
      fontSize: primitive.fontSize['2xl'],
      lineHeight: primitive.lineHeight.snug,
      fontWeight: primitive.fontWeight.semibold,
      letterSpacing: primitive.letterSpacing.normal,
    },
    h5: {
      fontSize: primitive.fontSize.xl,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.semibold,
      letterSpacing: primitive.letterSpacing.normal,
    },
    h6: {
      fontSize: primitive.fontSize.lg,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.semibold,
      letterSpacing: primitive.letterSpacing.normal,
    },
  },

  // Interactive elements
  interactive: {
    link: {
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontWeight: primitive.fontWeight.medium,
      textDecoration: 'underline',
    },
    linkButton: {
      fontSize: primitive.fontSize.base,
      lineHeight: primitive.lineHeight.none,
      fontWeight: primitive.fontWeight.semibold,
      textDecoration: 'none',
    },
  },
};

// COMPONENT TOKENS (Context-specific typography)
export const component = {
  // Hero section typography
  hero: {
    title: {
      ...semantic.heading.h1,
      // Responsive scaling
      mobile: {
        fontSize: primitive.fontSize['3xl'],  // 30px on mobile
        lineHeight: primitive.lineHeight.tight,
      },
      tablet: {
        fontSize: primitive.fontSize['4xl'],  // 36px on tablet
        lineHeight: primitive.lineHeight.tight,
      },
      desktop: {
        fontSize: primitive.fontSize['6xl'],  // 60px on desktop
        lineHeight: primitive.lineHeight.tight,
      },
      large: {
        fontSize: primitive.fontSize['7xl'],  // 72px on large screens
        lineHeight: primitive.lineHeight.tight,
      },
    },
    subtitle: {
      ...semantic.text.bodyLarge,
      mobile: {
        fontSize: primitive.fontSize.lg,     // 18px on mobile
        lineHeight: primitive.lineHeight.relaxed,
      },
      tablet: {
        fontSize: primitive.fontSize.xl,     // 20px on tablet
        lineHeight: primitive.lineHeight.relaxed,
      },
      desktop: {
        fontSize: primitive.fontSize['2xl'], // 24px on desktop
        lineHeight: primitive.lineHeight.relaxed,
      },
    },
    gradient: {
      background: 'linear-gradient(45deg, #fb923c, #ef4444)',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },

  // Button typography variants
  button: {
    sm: {
      fontSize: primitive.fontSize.sm,
      lineHeight: primitive.lineHeight.none,
      fontWeight: primitive.fontWeight.medium,
    },
    md: {
      fontSize: primitive.fontSize.base,
      lineHeight: primitive.lineHeight.none,
      fontWeight: primitive.fontWeight.semibold,
    },
    lg: {
      fontSize: primitive.fontSize.lg,
      lineHeight: primitive.lineHeight.none,
      fontWeight: primitive.fontWeight.semibold,
    },
  },

  // Card typography
  card: {
    title: {
      fontSize: primitive.fontSize.xl,
      lineHeight: primitive.lineHeight.snug,
      fontWeight: primitive.fontWeight.semibold,
    },
    description: {
      fontSize: primitive.fontSize.base,
      lineHeight: primitive.lineHeight.relaxed,
      fontWeight: primitive.fontWeight.normal,
    },
    caption: {
      fontSize: primitive.fontSize.sm,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.normal,
    },
  },

  // Social proof typography
  socialProof: {
    title: {
      fontSize: primitive.fontSize.sm,
      lineHeight: primitive.lineHeight.snug,
      fontWeight: primitive.fontWeight.semibold,
    },
    subtitle: {
      fontSize: primitive.fontSize.xs,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.normal,
    },
    sectionTitle: {
      fontSize: primitive.fontSize['3xl'],
      lineHeight: primitive.lineHeight.snug,
      fontWeight: primitive.fontWeight.semibold,
      mobile: {
        fontSize: primitive.fontSize.xl,
      },
      tablet: {
        fontSize: primitive.fontSize['2xl'],
      },
    },
  },

  // Navigation typography
  nav: {
    link: {
      fontSize: primitive.fontSize.base,
      lineHeight: primitive.lineHeight.none,
      fontWeight: primitive.fontWeight.medium,
    },
    button: {
      fontSize: primitive.fontSize.sm,
      lineHeight: primitive.lineHeight.none,
      fontWeight: primitive.fontWeight.semibold,
    },
  },

  // Form typography
  form: {
    label: {
      fontSize: primitive.fontSize.sm,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.medium,
    },
    input: {
      fontSize: primitive.fontSize.base,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.normal,
    },
    helper: {
      fontSize: primitive.fontSize.xs,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.normal,
    },
    error: {
      fontSize: primitive.fontSize.xs,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.medium,
    },
  },

  // Testimonial typography
  testimonial: {
    quote: {
      fontSize: primitive.fontSize.lg,
      lineHeight: primitive.lineHeight.relaxed,
      fontWeight: primitive.fontWeight.normal,
      fontStyle: 'italic',
    },
    author: {
      fontSize: primitive.fontSize.base,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.semibold,
    },
    role: {
      fontSize: primitive.fontSize.sm,
      lineHeight: primitive.lineHeight.normal,
      fontWeight: primitive.fontWeight.normal,
    },
  },
};

// RESPONSIVE TYPOGRAPHY (Breakpoint-aware)
export const responsive = {
  // Common responsive patterns used in existing components
  patterns: {
    heroTitle: 'text-3xl sm:text-4xl md:text-6xl lg:text-7xl',
    heroSubtitle: 'text-lg sm:text-xl md:text-2xl',
    sectionTitle: 'text-2xl sm:text-3xl md:text-4xl',
    cardTitle: 'text-lg md:text-xl',
    body: 'text-base md:text-lg',
    caption: 'text-sm md:text-base',
  },

  // Breakpoint-specific scales
  scales: {
    mobile: {
      hero: component.hero.title.mobile,
      section: { fontSize: primitive.fontSize.xl },
      card: { fontSize: primitive.fontSize.lg },
    },
    tablet: {
      hero: component.hero.title.tablet,
      section: { fontSize: primitive.fontSize['2xl'] },
      card: { fontSize: primitive.fontSize.xl },
    },
    desktop: {
      hero: component.hero.title.desktop,
      section: { fontSize: primitive.fontSize['3xl'] },
      card: { fontSize: primitive.fontSize.xl },
    },
  },
};

// UTILITY FUNCTIONS
export const utilities = {
  // Generate responsive font size classes
  responsiveSize: (mobile: string, tablet?: string, desktop?: string) => {
    let classes = mobile;
    if (tablet) classes += ` md:${tablet}`;
    if (desktop) classes += ` lg:${desktop}`;
    return classes;
  },

  // Generate font style combinations
  fontStyle: (weight: keyof typeof primitive.fontWeight, size: keyof typeof primitive.fontSize) => ({
    fontWeight: primitive.fontWeight[weight],
    fontSize: primitive.fontSize[size],
    fontFamily: primitive.fontFamily.sans.join(', '),
  }),

  // Text truncation utilities
  truncate: {
    single: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    multiline: (lines: number) => ({
      display: '-webkit-box',
      WebkitLineClamp: lines,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }),
  },
};

// Legacy compatibility
export const typography = {
  fontFamily: primitive.fontFamily,
  fontSize: primitive.fontSize,
  fontWeight: primitive.fontWeight,
  lineHeight: primitive.lineHeight,
  letterSpacing: primitive.letterSpacing,
  heading: semantic.heading,
  text: semantic.text,
};