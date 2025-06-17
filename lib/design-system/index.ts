// Design System: Central Export
// This file provides the main entry point for the Testero design system

// Token exports (W3C compliant architecture) - using specific imports to avoid conflicts
// Note: Using specific imports instead of star exports to prevent naming conflicts

// Component style configurations
export * from './components';

// Legacy compatibility exports
export * from './animations';
export * from './breakpoints';

// Convenience re-exports for common usage patterns
export { 
  // Color tokens
  primitive as colorPrimitive,
  semantic as colorSemantic,
  component as colorComponent,
  colors as legacyColors,
  colors // Legacy export for backwards compatibility
} from './tokens/colors';

export {
  // Spacing tokens
  primitive as spacingPrimitive,
  semantic as spacingSemantic,
  component as spacingComponent,
  spacing as legacySpacing,
  spacing // Legacy export for backwards compatibility
} from './tokens/spacing';

export {
  // Typography tokens
  primitive as typographyPrimitive,
  semantic as typographySemantic,
  component as typographyComponent,
  typography as legacyTypography,
  typography // Legacy export for backwards compatibility
} from './tokens/typography';

export {
  // Effects tokens
  primitive as effectsPrimitive,
  semantic as effectsSemantic,
  component as effectsComponent,
  gradients,
  keyframes,
  effects as legacyEffects,
  effects // Legacy export for backwards compatibility
} from './tokens/effects';

export {
  // Component variants
  buttonVariants,
  cardVariants,
  heroVariants,
  socialProofVariants,
  components,
  componentUtils,
  // Legacy compatibility
  button as legacyButton,
  card as legacyCard
} from './components';

// Design system metadata
export const designSystemVersion = '2.0.0';
export const designSystemInfo = {
  name: 'Testero Design System',
  version: designSystemVersion,
  specification: 'W3C Design Tokens',
  architecture: 'primitive → semantic → component',
  lastUpdated: '2025-01-16',
  description: 'Token-first design system for consistent UI patterns and modern SaaS styling',
};
