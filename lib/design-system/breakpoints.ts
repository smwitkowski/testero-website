// Design System: Breakpoints
// This file defines the responsive breakpoints for the Testero waitlist page

// Breakpoint sizes in pixels
export const breakpoints = {
  xs: 320,   // Small mobile
  sm: 640,   // Mobile
  md: 768,   // Tablet
  lg: 1024,  // Small desktop/laptop
  xl: 1280,  // Desktop
  '2xl': 1536, // Large desktop
};

// Media query strings for use in CSS-in-JS
export const mediaQueries = {
  xs: `(min-width: ${breakpoints.xs}px)`,
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  '2xl': `(min-width: ${breakpoints['2xl']}px)`,
  
  // Max-width queries for targeting specific ranges
  xsOnly: `(max-width: ${breakpoints.sm - 1}px)`,
  smOnly: `(min-width: ${breakpoints.sm}px) and (max-width: ${breakpoints.md - 1}px)`,
  mdOnly: `(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`,
  lgOnly: `(min-width: ${breakpoints.lg}px) and (max-width: ${breakpoints.xl - 1}px)`,
  xlOnly: `(min-width: ${breakpoints.xl}px) and (max-width: ${breakpoints['2xl'] - 1}px)`,
  '2xlOnly': `(min-width: ${breakpoints['2xl']}px)`,
  
  // Other useful queries
  mobile: `(max-width: ${breakpoints.md - 1}px)`,
  tablet: `(min-width: ${breakpoints.md}px) and (max-width: ${breakpoints.lg - 1}px)`,
  desktop: `(min-width: ${breakpoints.lg}px)`,
  touch: `(max-width: ${breakpoints.lg - 1}px)`,
  
  // Dark mode and preferences
  dark: '(prefers-color-scheme: dark)',
  light: '(prefers-color-scheme: light)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
};

// Responsive patterns and guidelines
export const responsive = {
  // Layout adaptation
  layout: {
    mobile: {
      // Mobile-specific layout adjustments
      singleColumn: true,
      stackedNavigation: true,
      fullWidthImages: true,
      compactSpacing: true,
    },
    tablet: {
      // Tablet-specific layout adjustments
      singleColumn: false,
      twoColumnLayout: true,
      compactNavigation: true,
      expandedCards: true,
    },
    desktop: {
      // Desktop-specific layout adjustments
      multiColumn: true,
      horizontalNavigation: true,
      expandedContent: true,
      wideSpacing: true,
    },
  },

  // Component adaptation
  components: {
    // How components should adapt across breakpoints
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
  },

  // Container widths
  container: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};
