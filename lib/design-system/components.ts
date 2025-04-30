// Design System: Component Styles
// This file defines the component styles and variants for the Testero waitlist page

import { colors, colorUsage } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { animationUsage } from './animations';

// Button variants and styles
export const button = {
  // Base styles applied to all buttons
  base: {
    fontFamily: typography.button.default.fontFamily,
    fontSize: typography.button.default.fontSize,
    fontWeight: typography.button.default.fontWeight,
    lineHeight: typography.button.default.lineHeight,
    borderRadius: spacing[2],
    padding: `${spacing[3]} ${spacing[6]}`,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
    border: 'none',
    outline: 'none',
    whiteSpace: 'nowrap',
  },
  
  // Size variants
  size: {
    sm: {
      fontSize: typography.button.small.fontSize,
      padding: `${spacing[2]} ${spacing[4]}`,
      borderRadius: spacing[1],
    },
    md: {
      // Default size, inherits from base
    },
    lg: {
      fontSize: typography.button.large.fontSize,
      padding: `${spacing[4]} ${spacing[8]}`,
      borderRadius: spacing[3],
    },
  },
  
  // Style variants
  variant: {
    // Primary action buttons (most emphasized)
    primary: {
      backgroundColor: colorUsage.button.primary.background,
      color: colorUsage.button.primary.text,
      '&:hover': {
        backgroundColor: colorUsage.button.primary.hover,
        ...animationUsage.button.hover,
      },
      '&:active': {
        ...animationUsage.button.active,
      },
      '&:focus': {
        ...animationUsage.button.focus,
      },
      '&:disabled': {
        backgroundColor: colors.primary[300],
        color: colors.primary[100],
        cursor: 'not-allowed',
      },
    },
    
    // Secondary action buttons (less emphasized)
    secondary: {
      backgroundColor: colorUsage.button.secondary.background,
      color: colorUsage.button.secondary.text,
      '&:hover': {
        backgroundColor: colorUsage.button.secondary.hover,
        ...animationUsage.button.hover,
      },
      '&:active': {
        ...animationUsage.button.active,
      },
      '&:focus': {
        ...animationUsage.button.focus,
      },
      '&:disabled': {
        backgroundColor: colors.primary[100],
        color: colors.primary[300],
        cursor: 'not-allowed',
      },
    },
    
    // Outline buttons (for secondary actions)
    outline: {
      backgroundColor: 'transparent',
      color: colorUsage.button.outline.text,
      border: `1px solid ${colorUsage.button.outline.border}`,
      '&:hover': {
        backgroundColor: colorUsage.button.outline.hover,
        ...animationUsage.button.hover,
      },
      '&:active': {
        ...animationUsage.button.active,
      },
      '&:focus': {
        ...animationUsage.button.focus,
      },
      '&:disabled': {
        borderColor: colors.primary[200],
        color: colors.primary[300],
        cursor: 'not-allowed',
      },
    },
    
    // Text buttons (minimal visual impact)
    text: {
      backgroundColor: 'transparent',
      color: colorUsage.text.accent,
      padding: `${spacing[1]} ${spacing[2]}`,
      '&:hover': {
        textDecoration: 'underline',
      },
      '&:active': {
        opacity: 0.8,
      },
      '&:disabled': {
        color: colors.primary[300],
        cursor: 'not-allowed',
      },
    },
  },
};

// Card component styles
export const card = {
  // Base styles for all cards
  base: {
    backgroundColor: colorUsage.card.background,
    borderRadius: spacing[3],
    boxShadow: `0 1px 3px ${colorUsage.card.shadow}`,
    border: `1px solid ${colorUsage.card.border}`,
    padding: spacing[6],
    transition: 'all 0.3s ease',
  },
  
  // Card variants
  variant: {
    // Default card style
    default: {
      // Inherits from base
    },
    // Cards with extra elevation
    elevated: {
      boxShadow: `0 4px 6px -1px ${colorUsage.card.shadow}, 0 2px 4px -1px ${colorUsage.card.shadow}`,
    },
    // Cards with more subtle styling
    flat: {
      boxShadow: 'none',
      border: `1px solid ${colors.primary[200]}`,
    },
    // Cards that change on hover
    interactive: {
      cursor: 'pointer',
      '&:hover': {
        boxShadow: `0 10px 15px -3px ${colorUsage.card.shadow}, 0 4px 6px -2px ${colorUsage.card.shadow}`,
        transform: 'translateY(-4px)',
      },
    },
  },
};

// Form element styles
export const form = {
  // Base styles for form elements
  input: {
    base: {
      fontFamily: typography.input.default.fontFamily,
      fontSize: typography.input.default.fontSize,
      lineHeight: typography.input.default.lineHeight,
      color: colorUsage.text.primary,
      backgroundColor: colorUsage.input.background,
      border: `1px solid ${colorUsage.input.border}`,
      borderRadius: spacing[2],
      padding: `${spacing[3]} ${spacing[4]}`,
      width: '100%',
      transition: 'all 0.3s ease',
      '&:focus': {
        outline: 'none',
        borderColor: colorUsage.input.borderFocus,
        boxShadow: `0 0 0 3px ${colors.accent[100]}`,
      },
      '&:disabled': {
        backgroundColor: colors.primary[100],
        cursor: 'not-allowed',
      },
      '&::placeholder': {
        color: colorUsage.input.placeholder,
      },
    },
    // Input field variants
    variant: {
      // Standard text input
      text: {},
      // Email input
      email: {},
      // Password input with potentially different styling
      password: {},
      // Textarea for multi-line text
      textarea: {
        minHeight: '100px',
        resize: 'vertical',
      },
    },
    // Input sizes
    size: {
      sm: {
        fontSize: typography.input.small.fontSize,
        padding: `${spacing[2]} ${spacing[3]}`,
      },
      md: {
        // Default size, inherits from base
      },
      lg: {
        fontSize: typography.input.large.fontSize,
        padding: `${spacing[4]} ${spacing[5]}`,
      },
    },
    // Input states
    state: {
      error: {
        borderColor: colors.feedback.error.base,
        '&:focus': {
          boxShadow: `0 0 0 3px ${colors.feedback.error.light}`,
        },
      },
      success: {
        borderColor: colors.feedback.success.base,
        '&:focus': {
          boxShadow: `0 0 0 3px ${colors.feedback.success.light}`,
        },
      },
    },
  },
  
  // Label styles
  label: {
    base: {
      display: 'block',
      marginBottom: spacing[2],
      fontSize: typography.body.small.fontSize,
      fontWeight: typography.body.small.fontWeight,
      color: colorUsage.text.secondary,
    },
    // Required label
    required: {
      '&::after': {
        content: '" *"',
        color: colors.feedback.error.base,
      },
    },
  },
  
  // Helper text and error message styles
  helperText: {
    base: {
      fontSize: typography.body.caption.fontSize,
      marginTop: spacing[1],
    },
    // Helper text variants
    variant: {
      default: {
        color: colorUsage.text.muted,
      },
      error: {
        color: colors.feedback.error.base,
      },
    },
  },
  
  // Form group (wrapping input, label, helper text)
  group: {
    marginBottom: spacing[6],
  },
};

// Iconography
export const icon = {
  // Base styles
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Icon sizes
  size: {
    sm: {
      width: spacing[4],
      height: spacing[4],
    },
    md: {
      width: spacing[6],
      height: spacing[6],
    },
    lg: {
      width: spacing[8],
      height: spacing[8],
    },
  },
};

// Badge/tag styles
export const badge = {
  // Base badge style
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: typography.body.caption.fontSize,
    fontWeight: typography.body.caption.fontWeight,
    lineHeight: 1,
    padding: `${spacing[1]} ${spacing[2]}`,
    borderRadius: spacing[2],
  },
  // Badge variants
  variant: {
    // Default badge (grey)
    default: {
      backgroundColor: colors.primary[100],
      color: colors.primary[700],
    },
    // Primary badge (brand color)
    primary: {
      backgroundColor: colors.accent[100],
      color: colors.accent[700],
    },
    // Success badge
    success: {
      backgroundColor: colors.feedback.success.light,
      color: colors.feedback.success.dark,
    },
    // Warning badge
    warning: {
      backgroundColor: colors.feedback.warning.light,
      color: colors.feedback.warning.dark,
    },
    // Error badge
    error: {
      backgroundColor: colors.feedback.error.light,
      color: colors.feedback.error.dark,
    },
  },
};
