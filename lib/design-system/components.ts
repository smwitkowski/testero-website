// Design System: Component Style Configurations
// This file defines reusable component variants and style configurations

import { semantic as colorSemantic, component as colorComponent } from './tokens/colors';
import { semantic as spacingSemantic, component as spacingComponent } from './tokens/spacing';
import { primitive as typographyPrimitive, component as typographyComponent } from './tokens/typography';
import { primitive as effectsPrimitive, semantic as effectsSemantic, component as effectsComponent } from './tokens/effects';

// BUTTON VARIANTS
export const buttonVariants = {
  // Base button styles
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: effectsPrimitive.borderRadius.lg,
    fontFamily: typographyPrimitive.fontFamily.sans.join(', '),
    fontWeight: typographyPrimitive.fontWeight.semibold,
    textDecoration: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    userSelect: 'none',
    '&:focus-visible': {
      outline: '2px solid transparent',
      outlineOffset: '2px',
      boxShadow: effectsSemantic.focus.ring,
    },
    '&:disabled': {
      opacity: effectsPrimitive.opacity[50],
      cursor: 'not-allowed',
    },
  },

  // Size variants
  sizes: {
    sm: {
      height: '2.25rem', // 36px
      padding: spacingComponent.button.padding.sm,
      fontSize: typographyComponent.button.sm.fontSize,
      lineHeight: typographyComponent.button.sm.lineHeight,
      gap: spacingSemantic.element.sm,
    },
    md: {
      height: '2.75rem', // 44px
      padding: spacingComponent.button.padding.md,
      fontSize: typographyComponent.button.md.fontSize,
      lineHeight: typographyComponent.button.md.lineHeight,
      gap: spacingSemantic.element.md,
    },
    lg: {
      height: '3.25rem', // 52px
      padding: `${spacingSemantic.element.lg} ${spacingSemantic.component.sm}`,
      fontSize: typographyComponent.button.lg.fontSize,
      lineHeight: typographyComponent.button.lg.lineHeight,
      gap: spacingSemantic.element.md,
    },
  },

  // Style variants
  variants: {
    primary: {
      background: colorComponent.button.primary.background,
      color: colorComponent.button.primary.text,
      boxShadow: effectsComponent.button.primary.shadow,
      '&:hover': {
        background: colorComponent.button.primary.backgroundHover,
        boxShadow: effectsComponent.button.primary.shadowHover,
        transform: 'scale(1.02)',
      },
      '&:active': {
        transform: 'scale(0.98)',
      },
    },
    secondary: {
      background: colorComponent.button.secondary.background,
      color: colorComponent.button.secondary.text,
      border: `1px solid ${colorComponent.button.secondary.border}`,
      boxShadow: effectsComponent.button.secondary.shadow,
      '&:hover': {
        background: colorComponent.button.secondary.backgroundHover,
        boxShadow: effectsComponent.button.secondary.shadowHover,
        transform: 'translateY(-2px)',
      },
      '&:active': {
        transform: 'translateY(0)',
      },
    },
    ghost: {
      background: colorComponent.button.ghost.background,
      color: colorComponent.button.ghost.text,
      border: `1px solid ${colorComponent.button.ghost.border}`,
      boxShadow: effectsComponent.button.ghost.shadow,
      '&:hover': {
        background: colorComponent.button.ghost.backgroundHover,
        boxShadow: effectsComponent.button.ghost.shadowHover,
      },
    },
    outline: {
      background: colorComponent.button.outline.background,
      color: colorComponent.button.outline.text,
      border: `1px solid ${colorComponent.button.outline.border}`,
      '&:hover': {
        background: colorComponent.button.outline.backgroundHover,
      },
    },
  },
};

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
