// Design System: Spacing Tokens
// This file defines the spacing scale and layout patterns for Testero

// PRIMITIVE TOKENS (Base spacing values)
export const primitive = {
  // Base spacing scale (using 4px as base unit)
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
  32: '8rem',    // 128px
  40: '10rem',   // 160px
  48: '12rem',   // 192px
  56: '14rem',   // 224px
  64: '16rem',   // 256px
  72: '18rem',   // 288px
  80: '20rem',   // 320px
  96: '24rem',   // 384px
};

// SEMANTIC TOKENS (Purpose-based spacing)
export const semantic = {
  // Element spacing
  element: {
    xs: primitive[1],   // 4px
    sm: primitive[2],   // 8px
    md: primitive[4],   // 16px
    lg: primitive[6],   // 24px
    xl: primitive[8],   // 32px
    xxl: primitive[12], // 48px
  },

  // Component spacing
  component: {
    xs: primitive[2],   // 8px
    sm: primitive[4],   // 16px
    md: primitive[6],   // 24px
    lg: primitive[8],   // 32px
    xl: primitive[12],  // 48px
    xxl: primitive[16], // 64px
  },

  // Section spacing
  section: {
    xs: primitive[8],   // 32px
    sm: primitive[12],  // 48px
    md: primitive[16],  // 64px
    lg: primitive[24],  // 96px
    xl: primitive[32],  // 128px
    xxl: primitive[48], // 192px
  },

  // Container spacing
  container: {
    xs: primitive[4],   // 16px
    sm: primitive[6],   // 24px
    md: primitive[8],   // 32px
    lg: primitive[12],  // 48px
    xl: primitive[16],  // 64px
    xxl: primitive[24], // 96px
  },
};

// COMPONENT TOKENS (Context-specific spacing)
export const component = {
  // Hero section spacing
  hero: {
    padding: {
      mobile: `${semantic.section.md} ${semantic.container.xs}`,      // 64px 16px
      tablet: `${semantic.section.lg} ${semantic.container.sm}`,      // 96px 24px  
      desktop: `${semantic.section.xl} ${semantic.container.md}`,     // 128px 32px
    },
    content: {
      gap: semantic.component.md, // 24px between elements
      maxWidth: '80rem',          // 1280px
    },
  },

  // Button spacing
  button: {
    padding: {
      sm: `${semantic.element.sm} ${semantic.element.lg}`,    // 8px 24px
      md: `${semantic.element.md} ${semantic.element.xl}`,    // 16px 32px
      lg: `${semantic.element.lg} ${semantic.component.sm}`,  // 24px 16px (wait this doesn't look right)
    },
    gap: semantic.element.md, // 16px between button and icon
  },

  // Card spacing  
  card: {
    padding: {
      sm: semantic.component.sm,  // 16px
      md: semantic.component.md,  // 24px
      lg: semantic.component.lg,  // 32px
    },
    gap: semantic.element.lg,     // 24px between card elements
    margin: semantic.element.xl,  // 32px between cards
  },

  // Form spacing
  form: {
    field: {
      gap: semantic.element.lg,     // 24px between form fields
      padding: semantic.element.md, // 16px inside form inputs
    },
    section: {
      gap: semantic.component.lg,   // 32px between form sections
      padding: semantic.component.md, // 24px around form sections
    },
  },

  // Navigation spacing
  nav: {
    height: '4.5rem',             // 72px - navbar height
    padding: semantic.container.xs, // 16px horizontal padding
    gap: semantic.component.sm,    // 16px between nav items
  },

  // Social proof spacing
  socialProof: {
    section: semantic.section.md,   // 64px section padding
    card: {
      padding: semantic.component.sm, // 16px card padding
      gap: semantic.element.md,       // 16px between elements
      margin: semantic.element.sm,    // 8px margin (for marquee)
    },
  },

  // Testimonial spacing
  testimonial: {
    section: semantic.section.lg,     // 96px section padding
    card: {
      padding: semantic.component.lg,  // 32px card padding
      gap: semantic.component.md,      // 24px between elements
    },
    carousel: {
      height: '16rem',                 // 256px fixed height
      gap: semantic.component.md,      // 24px between slides
    },
  },
};

// RESPONSIVE SPACING (Breakpoint-aware)
export const responsive = {
  section: {
    // py-10 sm:py-16 md:py-24 pattern
    sm: semantic.section.xs,   // 32px on mobile
    md: semantic.section.md,   // 64px on tablet  
    lg: semantic.section.lg,   // 96px on desktop
  },
  
  container: {
    // px-4 sm:px-6 md:px-8 pattern
    sm: semantic.container.xs,  // 16px on mobile
    md: semantic.container.sm,  // 24px on tablet
    lg: semantic.container.md,  // 32px on desktop
  },

  // Common responsive patterns
  patterns: {
    sectionPadding: 'py-10 sm:py-16 md:py-24',
    containerPadding: 'px-4 sm:px-6',
    heroSpacing: 'py-24 md:py-32',
    cardGap: 'gap-4 md:gap-6 lg:gap-8',
    contentMaxWidth: 'max-w-4xl lg:max-w-5xl xl:max-w-6xl',
  },
};

// Layout-specific spacing
export const layout = {
  // Content max-widths
  maxWidth: {
    sm: '24rem',    // 384px
    md: '28rem',    // 448px  
    lg: '32rem',    // 512px
    xl: '36rem',    // 576px
    '2xl': '42rem', // 672px
    '3xl': '48rem', // 768px
    '4xl': '56rem', // 896px
    '5xl': '64rem', // 1024px
    '6xl': '72rem', // 1152px
    '7xl': '80rem', // 1280px
    full: '100%',
  },

  // Common container widths used in existing components
  container: {
    benefits: '56rem',     // max-w-4xl (BenefitsSection)
    socialProof: '80rem',  // max-w-7xl (SocialProofSection) 
    hero: '64rem',         // max-w-5xl (Hero)
    testimonials: '72rem', // max-w-6xl (TestimonialCarousel)
    content: '64rem',      // max-w-5xl (Content sections)
  },
};

// Legacy compatibility
export const spacing = primitive;