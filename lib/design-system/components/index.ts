// Design System: Component Style Configurations
// This file defines reusable component variants and style configurations

import { semantic as colorSemantic, component as colorComponent } from '../tokens/colors';
import { semantic as spacingSemantic, component as spacingComponent } from '../tokens/spacing';
import { component as typographyComponent } from '../tokens/typography';
import { primitive as effectsPrimitive, component as effectsComponent } from '../tokens/effects';

// BUTTON VARIANTS
// ---------------------------------------------------------------------------
// The button maps exposed here are consumed by the shared <Button />
// implementation.  They intentionally only reference Tailwind utilities that
// resolve to design-system CSS variables so that theming automatically follows
// token swaps (e.g. light ↔ dark modes).

export const buttonBase = [
  // Layout
  'relative inline-flex items-center justify-center gap-2 font-medium',
  'rounded-lg transition-colors duration-150 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  // Interaction states
  'disabled:pointer-events-none disabled:opacity-60 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-60',
  'data-[loading=true]:cursor-progress',
  'motion-reduce:transition-none',
].join(' ');

export const buttonSizeStyles = {
  sm: 'h-9 min-h-[36px] px-3 text-sm leading-5',
  md: 'h-11 min-h-[44px] px-4 text-base leading-6',
  lg: 'h-12 min-h-[48px] px-5 text-lg leading-7',
} as const;

const toneFocusRing = {
  default: 'focus-visible:ring-primary',
  accent: 'focus-visible:ring-accent',
  success: 'focus-visible:ring-success',
  warn: 'focus-visible:ring-warning',
  danger: 'focus-visible:ring-destructive',
  neutral: 'focus-visible:ring-ring',
} as const;

export const buttonVariantStyles = {
  solid: 'shadow-sm ring-1 ring-inset ring-transparent',
  soft: 'bg-transparent ring-1 ring-inset ring-transparent',
  outline: 'bg-transparent border ring-1 ring-inset border-transparent shadow-sm',
  ghost: 'bg-transparent shadow-none ring-0',
  link: 'bg-transparent shadow-none ring-0 underline-offset-4 hover:underline focus-visible:underline font-medium',
  tone: {
    default: [
      toneFocusRing.default,
      'data-[variant=solid]:bg-primary data-[variant=solid]:text-primary-foreground data-[variant=solid]:hover:bg-primary/90',
      'data-[variant=soft]:bg-primary/10 data-[variant=soft]:text-primary data-[variant=soft]:hover:bg-primary/15 data-[variant=soft]:ring-primary/30',
      'data-[variant=outline]:border-primary data-[variant=outline]:text-primary data-[variant=outline]:hover:bg-primary/10',
      'data-[variant=ghost]:text-primary data-[variant=ghost]:hover:bg-primary/10',
      'data-[variant=link]:text-primary data-[variant=link]:hover:text-primary/80',
    ].join(' '),
    accent: [
      toneFocusRing.accent,
      'data-[variant=solid]:bg-accent data-[variant=solid]:text-accent-foreground data-[variant=solid]:hover:bg-accent/90',
      'data-[variant=soft]:bg-accent/15 data-[variant=soft]:text-accent data-[variant=soft]:hover:bg-accent/20 data-[variant=soft]:ring-accent/30',
      'data-[variant=outline]:border-accent data-[variant=outline]:text-accent data-[variant=outline]:hover:bg-accent/10',
      'data-[variant=ghost]:text-accent data-[variant=ghost]:hover:bg-accent/10',
      'data-[variant=link]:text-accent data-[variant=link]:hover:text-accent/80',
    ].join(' '),
    success: [
      toneFocusRing.success,
      'data-[variant=solid]:bg-success data-[variant=solid]:text-neutral-50 data-[variant=solid]:hover:bg-success/90',
      'data-[variant=soft]:bg-success/15 data-[variant=soft]:text-success data-[variant=soft]:hover:bg-success/20 data-[variant=soft]:ring-success/30',
      'data-[variant=outline]:border-success data-[variant=outline]:text-success data-[variant=outline]:hover:bg-success/10',
      'data-[variant=ghost]:text-success data-[variant=ghost]:hover:bg-success/10',
      'data-[variant=link]:text-success data-[variant=link]:hover:text-success/80',
    ].join(' '),
    warn: [
      toneFocusRing.warn,
      'data-[variant=solid]:bg-warning data-[variant=solid]:text-neutral-950 data-[variant=solid]:hover:bg-warning/90',
      'data-[variant=soft]:bg-warning/20 data-[variant=soft]:text-warning data-[variant=soft]:hover:bg-warning/30 data-[variant=soft]:ring-warning/30',
      'data-[variant=outline]:border-warning data-[variant=outline]:text-warning data-[variant=outline]:hover:bg-warning/20',
      'data-[variant=ghost]:text-warning data-[variant=ghost]:hover:bg-warning/20',
      'data-[variant=link]:text-warning data-[variant=link]:hover:text-warning/80',
    ].join(' '),
    danger: [
      toneFocusRing.danger,
      'data-[variant=solid]:bg-destructive data-[variant=solid]:text-destructive-foreground data-[variant=solid]:hover:bg-destructive/90',
      'data-[variant=soft]:bg-destructive/15 data-[variant=soft]:text-destructive data-[variant=soft]:hover:bg-destructive/25 data-[variant=soft]:ring-destructive/30',
      'data-[variant=outline]:border-destructive data-[variant=outline]:text-destructive data-[variant=outline]:hover:bg-destructive/10',
      'data-[variant=ghost]:text-destructive data-[variant=ghost]:hover:bg-destructive/10',
      'data-[variant=link]:text-destructive data-[variant=link]:hover:text-destructive/80',
    ].join(' '),
    neutral: [
      toneFocusRing.neutral,
      'data-[variant=solid]:bg-muted data-[variant=solid]:text-foreground data-[variant=solid]:hover:bg-muted/80',
      'data-[variant=soft]:bg-muted/70 data-[variant=soft]:text-foreground data-[variant=soft]:hover:bg-muted/60 data-[variant=soft]:ring-border',
      'data-[variant=outline]:border-border data-[variant=outline]:text-foreground data-[variant=outline]:hover:bg-muted/70',
      'data-[variant=ghost]:text-foreground data-[variant=ghost]:hover:bg-muted/70',
      'data-[variant=link]:text-foreground data-[variant=link]:hover:text-foreground/80',
    ].join(' '),
  },
} as const;

export const buttonVariants = {
  base: buttonBase,
  sizes: buttonSizeStyles,
  variants: {
    solid: buttonVariantStyles.solid,
    soft: buttonVariantStyles.soft,
    outline: buttonVariantStyles.outline,
    ghost: buttonVariantStyles.ghost,
    link: buttonVariantStyles.link,
  },
  tone: buttonVariantStyles.tone,
} as const;

// CARD VARIANTS
export const cardVariants = {
  // Base card styles
  base: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    borderRadius: effectsComponent.card.default.borderRadius,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Style variants
  variants: {
    default: {
      background: colorComponent.card.default.background,
      border: effectsComponent.card.default.border,
      boxShadow: effectsComponent.card.default.shadow,
      '&:hover': {
        boxShadow: effectsComponent.card.default.shadowHover,
        transform: 'translateY(-2px)',
      },
    },
    elevated: {
      background: colorComponent.card.elevated.background,
      border: effectsComponent.card.elevated.border,
      boxShadow: effectsComponent.card.elevated.shadow,
      borderRadius: effectsComponent.card.elevated.borderRadius,
      '&:hover': {
        boxShadow: effectsComponent.card.elevated.shadowHover,
        transform: 'translateY(-4px)',
      },
    },
    glass: {
      background: colorComponent.card.glass.background,
      border: colorComponent.card.glass.border,
      backdropFilter: colorComponent.card.glass.backdrop,
      boxShadow: effectsComponent.card.glass.shadow,
      borderRadius: effectsComponent.card.glass.borderRadius,
      '&:hover': {
        boxShadow: effectsComponent.card.glass.shadowHover,
        transform: 'translateY(-2px)',
      },
    },
  },

  // Size variants (padding)
  sizes: {
    sm: {
      padding: spacingComponent.card.padding.sm,
    },
    md: {
      padding: spacingComponent.card.padding.md,
    },
    lg: {
      padding: spacingComponent.card.padding.lg,
    },
  },

  // Content spacing
  content: {
    gap: spacingComponent.card.gap,
    title: {
      fontSize: typographyComponent.card.title.fontSize,
      lineHeight: typographyComponent.card.title.lineHeight,
      fontWeight: typographyComponent.card.title.fontWeight,
      color: colorSemantic.text.primary,
      marginBottom: spacingSemantic.element.md,
    },
    description: {
      fontSize: typographyComponent.card.description.fontSize,
      lineHeight: typographyComponent.card.description.lineHeight,
      fontWeight: typographyComponent.card.description.fontWeight,
      color: colorSemantic.text.secondary,
      marginBottom: spacingSemantic.element.lg,
    },
    caption: {
      fontSize: typographyComponent.card.caption.fontSize,
      lineHeight: typographyComponent.card.caption.lineHeight,
      fontWeight: typographyComponent.card.caption.fontWeight,
      color: colorSemantic.text.muted,
    },
  },
};

// HERO SECTION VARIANTS
export const heroVariants = {
  // Base hero styles
  base: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    background: colorComponent.hero.background.dark,
  },

  // Size variants
  sizes: {
    sm: {
      padding: spacingComponent.hero.padding.mobile,
      minHeight: '60vh',
    },
    md: {
      padding: spacingComponent.hero.padding.tablet,
      minHeight: '70vh',
    },
    lg: {
      padding: spacingComponent.hero.padding.desktop,
      minHeight: '80vh',
    },
  },

  // Content layout
  content: {
    maxWidth: spacingComponent.hero.content.maxWidth,
    gap: spacingComponent.hero.content.gap,
    textAlign: 'center',
    position: 'relative',
    zIndex: 10,
  },

  // Typography
  typography: {
    title: {
      fontSize: typographyComponent.hero.title.mobile.fontSize,
      lineHeight: typographyComponent.hero.title.mobile.lineHeight,
      fontWeight: typographyComponent.hero.title.fontWeight,
      color: colorComponent.hero.text.primary,
      marginBottom: spacingSemantic.component.md,
      '@media (min-width: 768px)': {
        fontSize: typographyComponent.hero.title.tablet.fontSize,
      },
      '@media (min-width: 1024px)': {
        fontSize: typographyComponent.hero.title.desktop.fontSize,
      },
      '@media (min-width: 1280px)': {
        fontSize: typographyComponent.hero.title.large.fontSize,
      },
    },
    subtitle: {
      fontSize: typographyComponent.hero.subtitle.mobile.fontSize,
      lineHeight: typographyComponent.hero.subtitle.mobile.lineHeight,
      color: colorComponent.hero.text.secondary,
      marginBottom: spacingSemantic.component.lg,
      maxWidth: '48rem', // 768px
      '@media (min-width: 768px)': {
        fontSize: typographyComponent.hero.subtitle.tablet.fontSize,
      },
      '@media (min-width: 1024px)': {
        fontSize: typographyComponent.hero.subtitle.desktop.fontSize,
      },
    },
    gradient: {
      background: typographyComponent.hero.gradient.background,
      backgroundClip: typographyComponent.hero.gradient.backgroundClip,
      color: typographyComponent.hero.gradient.color,
    },
  },

  // Spotlight effects
  spotlight: {
    primary: effectsComponent.hero.spotlight.primary,
    secondary: effectsComponent.hero.spotlight.secondary,
    accent: effectsComponent.hero.spotlight.accent,
  },
};

// SOCIAL PROOF VARIANTS
export const socialProofVariants = {
  // Base section styles
  section: {
    width: '100%',
    background: colorSemantic.background.default,
    padding: spacingComponent.socialProof.section,
    overflow: 'hidden',
  },

  // Card styles
  card: {
    background: colorComponent.socialProof.badge.background,
    border: `1px solid ${colorComponent.socialProof.badge.border}`,
    borderRadius: effectsComponent.socialProof.card.borderRadius,
    padding: spacingComponent.socialProof.card.padding,
    boxShadow: effectsComponent.socialProof.card.shadow,
    display: 'flex',
    alignItems: 'center',
    gap: spacingComponent.socialProof.card.gap,
    minWidth: '200px',
    margin: spacingComponent.socialProof.card.margin,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: effectsComponent.socialProof.card.transform,
    '&:hover': {
      boxShadow: effectsComponent.socialProof.card.shadowHover,
      transform: effectsComponent.socialProof.card.transformHover,
    },
  },

  // Typography
  typography: {
    sectionTitle: {
      fontSize: typographyComponent.socialProof.sectionTitle.fontSize,
      lineHeight: typographyComponent.socialProof.sectionTitle.lineHeight,
      fontWeight: typographyComponent.socialProof.sectionTitle.fontWeight,
      color: colorSemantic.text.secondary,
      textAlign: 'center',
      marginBottom: spacingSemantic.section.sm,
      '@media (max-width: 768px)': {
        fontSize: typographyComponent.socialProof.sectionTitle.mobile.fontSize,
      },
      '@media (min-width: 768px) and (max-width: 1024px)': {
        fontSize: typographyComponent.socialProof.sectionTitle.tablet.fontSize,
      },
    },
    cardTitle: {
      fontSize: typographyComponent.socialProof.title.fontSize,
      lineHeight: typographyComponent.socialProof.title.lineHeight,
      fontWeight: typographyComponent.socialProof.title.fontWeight,
      color: colorComponent.socialProof.badge.text,
    },
    cardSubtitle: {
      fontSize: typographyComponent.socialProof.subtitle.fontSize,
      lineHeight: typographyComponent.socialProof.subtitle.lineHeight,
      fontWeight: typographyComponent.socialProof.subtitle.fontWeight,
      color: colorSemantic.text.muted,
    },
  },

  // Icon container
  icon: {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: effectsPrimitive.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Marquee effects
  marquee: {
    mask: effectsComponent.socialProof.marquee.mask,
  },
};

// UTILITY FUNCTIONS FOR COMPONENT GENERATION
export const componentUtils = {
  // Generate responsive padding classes
  responsivePadding: (mobile: string, tablet?: string, desktop?: string) => {
    let classes = mobile;
    if (tablet) classes += ` md:${tablet}`;
    if (desktop) classes += ` lg:${desktop}`;
    return classes;
  },

  // Generate component class string from variant object
  generateClasses: (variant: Record<string, unknown>, prefix = ''): string => {
    return Object.entries(variant)
      .map(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          return componentUtils.generateClasses(value as Record<string, unknown>, `${prefix}${key}-`);
        }
        return `${prefix}${key}-${String(value)}`;
      })
      .join(' ');
  },

  // Create CSS-in-JS styles from variant
  createStyles: (variant: Record<string, unknown>) => {
    const styles: Record<string, unknown> = {};
    Object.entries(variant).forEach(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null && key.startsWith('&')) {
        // Handle pseudo-selectors
        styles[key] = value;
      } else {
        styles[key] = value;
      }
    });
    return styles;
  },
};

// COMPONENT LIBRARY EXPORTS
export const components = {
  button: buttonVariants,
  card: cardVariants,
  hero: heroVariants,
  socialProof: socialProofVariants,
};

// Legacy compatibility
export const button = buttonVariants;
export const card = cardVariants;

export * from "./page-header"
export * from "./empty-state"
export * from "./table"
export * from "./toast"
