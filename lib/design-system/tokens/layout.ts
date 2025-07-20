// Design System: Layout Tokens
// This file defines breakpoints, containers, and responsive patterns for Testero

// PRIMITIVE TOKENS (Base layout values)
export const primitive = {
  // Breakpoint sizes in pixels
  breakpoints: {
    xs: 320,   // Small mobile
    sm: 640,   // Mobile
    md: 768,   // Tablet
    lg: 1024,  // Small desktop/laptop
    xl: 1280,  // Desktop
    '2xl': 1536, // Large desktop
  },

  // Container max-widths
  containers: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Grid columns
  grid: {
    1: '1',
    2: '2',
    3: '3',
    4: '4',
    5: '5',
    6: '6',
    7: '7',
    8: '8',
    9: '9',
    10: '10',
    11: '11',
    12: '12',
  },
};

// SEMANTIC TOKENS (Purpose-based layout)
export const semantic = {
  // Media query strings for use in CSS-in-JS
  mediaQueries: {
    xs: `(min-width: ${primitive.breakpoints.xs}px)`,
    sm: `(min-width: ${primitive.breakpoints.sm}px)`,
    md: `(min-width: ${primitive.breakpoints.md}px)`,
    lg: `(min-width: ${primitive.breakpoints.lg}px)`,
    xl: `(min-width: ${primitive.breakpoints.xl}px)`,
    '2xl': `(min-width: ${primitive.breakpoints['2xl']}px)`,
    
    // Max-width queries for targeting specific ranges
    xsOnly: `(max-width: ${primitive.breakpoints.sm - 1}px)`,
    smOnly: `(min-width: ${primitive.breakpoints.sm}px) and (max-width: ${primitive.breakpoints.md - 1}px)`,
    mdOnly: `(min-width: ${primitive.breakpoints.md}px) and (max-width: ${primitive.breakpoints.lg - 1}px)`,
    lgOnly: `(min-width: ${primitive.breakpoints.lg}px) and (max-width: ${primitive.breakpoints.xl - 1}px)`,
    xlOnly: `(min-width: ${primitive.breakpoints.xl}px) and (max-width: ${primitive.breakpoints['2xl'] - 1}px)`,
    '2xlOnly': `(min-width: ${primitive.breakpoints['2xl']}px)`,
    
    // Device-specific queries
    mobile: `(max-width: ${primitive.breakpoints.md - 1}px)`,
    tablet: `(min-width: ${primitive.breakpoints.md}px) and (max-width: ${primitive.breakpoints.lg - 1}px)`,
    desktop: `(min-width: ${primitive.breakpoints.lg}px)`,
    touch: `(max-width: ${primitive.breakpoints.lg - 1}px)`,
    
    // User preferences
    dark: '(prefers-color-scheme: dark)',
    light: '(prefers-color-scheme: light)',
    reducedMotion: '(prefers-reduced-motion: reduce)',
  },

  // Responsive spacing patterns
  spacing: {
    mobile: 'compact',
    tablet: 'comfortable',
    desktop: 'spacious',
  },

  // Responsive grid patterns
  gridPatterns: {
    single: { mobile: 1, tablet: 1, desktop: 1 },
    half: { mobile: 1, tablet: 2, desktop: 2 },
    third: { mobile: 1, tablet: 2, desktop: 3 },
    quarter: { mobile: 1, tablet: 2, desktop: 4 },
    auto: { mobile: 1, tablet: 'auto', desktop: 'auto' },
  },
};

// COMPONENT TOKENS (Context-specific layout)
export const component = {
  // Layout adaptation patterns
  layout: {
    mobile: {
      singleColumn: true,
      stackedNavigation: true,
      fullWidthImages: true,
      compactSpacing: true,
    },
    tablet: {
      singleColumn: false,
      twoColumnLayout: true,
      compactNavigation: true,
      expandedCards: true,
    },
    desktop: {
      multiColumn: true,
      horizontalNavigation: true,
      expandedContent: true,
      wideSpacing: true,
    },
  },

  // Component responsive behavior
  components: {
    cards: {
      mobile: 'fullWidth',
      tablet: 'gridLayout',
      desktop: 'gridLayout',
    },
    navigation: {
      mobile: 'hamburgerMenu',
      tablet: 'compactNav',
      desktop: 'fullNav',
    },
    forms: {
      mobile: 'stackedLabels',
      tablet: 'inlineLabels',
      desktop: 'inlineLabels',
    },
    hero: {
      mobile: { padding: 'md', fontSize: 'sm' },
      tablet: { padding: 'lg', fontSize: 'md' },
      desktop: { padding: 'xl', fontSize: 'lg' },
    },
    socialProof: {
      mobile: { columns: 1, showAll: false },
      tablet: { columns: 2, showAll: true },
      desktop: { columns: 3, showAll: true },
    },
  },

  // Page-specific layouts
  pages: {
    landing: {
      maxWidth: primitive.containers['2xl'],
      padding: { mobile: 'md', tablet: 'lg', desktop: 'xl' },
    },
    dashboard: {
      maxWidth: primitive.containers.xl,
      padding: { mobile: 'sm', tablet: 'md', desktop: 'lg' },
    },
    form: {
      maxWidth: primitive.containers.md,
      padding: { mobile: 'md', tablet: 'lg', desktop: 'lg' },
    },
  },
};

// RESPONSIVE UTILITIES
export const responsive = {
  // Container widths (legacy compatibility)
  container: primitive.containers,

  // Breakpoint utilities
  breakpoint: {
    isMobile: (width: number) => width < primitive.breakpoints.md,
    isTablet: (width: number) => width >= primitive.breakpoints.md && width < primitive.breakpoints.lg,
    isDesktop: (width: number) => width >= primitive.breakpoints.lg,
  },

  // Grid utilities
  grid: {
    getColumns: (breakpoint: 'mobile' | 'tablet' | 'desktop', pattern: keyof typeof semantic.gridPatterns) => {
      return semantic.gridPatterns[pattern][breakpoint];
    },
  },
};

// Legacy compatibility exports
export const breakpoints = primitive.breakpoints;
export const mediaQueries = semantic.mediaQueries;
export const layout = {
  breakpoints: primitive.breakpoints,
  mediaQueries: semantic.mediaQueries,
  responsive: component.layout,
  components: component.components,
  container: primitive.containers,
};