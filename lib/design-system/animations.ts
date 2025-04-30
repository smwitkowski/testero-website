// Design System: Animations
// This file defines the animation patterns for the Testero waitlist page

// Animation durations (in milliseconds)
export const duration = {
  fast: 150,        // Quick micro-interactions
  default: 300,     // Standard animations
  slow: 500,        // Emphasized animations
  slower: 700,      // Extended animations
};

// Animation easing curves (standard CSS easing functions)
export const easing = {
  // Standard easings
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  
  // Custom cubic-bezier easings for more polished animations
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material standard
  accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',  // Material accelerate
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)', // Material decelerate
  
  // Springy animations (suitable for movements, transformations)
  spring: 'cubic-bezier(0.5, 0, 0.1, 1.4)',
  bounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

// Animation delays (in milliseconds)
export const delay = {
  none: 0,
  tiny: 50,
  short: 100,
  medium: 200,
  long: 300,
};

// Staggered animation settings
export const stagger = {
  children: 0.1,    // Delay between child elements (seconds)
  sibling: 0.05,    // Delay between sibling elements (seconds)
  list: 0.08,       // Delay for list items (seconds)
};

// Predefined animation presets for common use cases
export const animationPresets = {
  // Fade animations
  fadeIn: {
    keyframes: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    duration: duration.default,
    easing: easing.standard,
  },
  fadeOut: {
    keyframes: {
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
    duration: duration.default,
    easing: easing.standard,
  },
  
  // Slide animations
  slideInFromTop: {
    keyframes: {
      from: { transform: 'translateY(-20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    duration: duration.default,
    easing: easing.spring,
  },
  slideInFromBottom: {
    keyframes: {
      from: { transform: 'translateY(20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    duration: duration.default,
    easing: easing.spring,
  },
  slideInFromLeft: {
    keyframes: {
      from: { transform: 'translateX(-20px)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
    duration: duration.default,
    easing: easing.spring,
  },
  slideInFromRight: {
    keyframes: {
      from: { transform: 'translateX(20px)', opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
    },
    duration: duration.default,
    easing: easing.spring,
  },
  
  // Scale animations
  scaleIn: {
    keyframes: {
      from: { transform: 'scale(0.9)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 },
    },
    duration: duration.default,
    easing: easing.spring,
  },
  scaleOut: {
    keyframes: {
      from: { transform: 'scale(1)', opacity: 1 },
      to: { transform: 'scale(0.9)', opacity: 0 },
    },
    duration: duration.default,
    easing: easing.spring,
  },
  
  // For hover effects
  hover: {
    scale: {
      transform: 'scale(1.05)',
      transition: `transform ${duration.fast}ms ${easing.spring}`,
    },
    lift: {
      transform: 'translateY(-4px)',
      transition: `transform ${duration.fast}ms ${easing.spring}`,
    },
    glow: {
      boxShadow: '0 0 8px rgba(0, 0, 0, 0.2)',
      transition: `box-shadow ${duration.fast}ms ${easing.easeOut}`,
    },
  },
};

// Guidelines for animation usage based on component types
export const animationUsage = {
  button: {
    hover: animationPresets.hover.scale,
    active: {
      transform: 'scale(0.97)',
      transition: `transform ${duration.fast}ms ${easing.easeInOut}`,
    },
    focus: animationPresets.hover.glow,
  },
  card: {
    hover: animationPresets.hover.lift,
    entry: animationPresets.scaleIn,
  },
  modal: {
    entry: animationPresets.scaleIn,
    exit: animationPresets.scaleOut,
  },
  notification: {
    entry: animationPresets.slideInFromTop,
    exit: animationPresets.fadeOut,
  },
  list: {
    entry: {
      ...animationPresets.fadeIn,
      stagger: stagger.list,
    },
  },
  form: {
    submission: {
      loading: {
        animation: 'spin 1s linear infinite',
      },
      success: {
        ...animationPresets.scaleIn,
        backgroundColor: 'rgba(0, 255, 0, 0.1)',
      },
      error: {
        transform: 'translateX(0)',
        keyframes: [
          { transform: 'translateX(-5px)', offset: 0.2 },
          { transform: 'translateX(5px)', offset: 0.4 },
          { transform: 'translateX(-5px)', offset: 0.6 },
          { transform: 'translateX(5px)', offset: 0.8 },
          { transform: 'translateX(0)', offset: 1 },
        ],
        duration: duration.slow,
        easing: easing.easeOut,
      },
    },
  },
};

// Reduced motion settings for accessibility
export const reducedMotion = {
  fadeOnly: {
    // Only use opacity changes, no movement
    entry: animationPresets.fadeIn,
    exit: animationPresets.fadeOut,
    
    // Replace movement animations with fade
    slideIn: animationPresets.fadeIn,
    slideOut: animationPresets.fadeOut,
    
    // Remove scale changes, keep opacity
    scaleIn: {
      keyframes: {
        from: { opacity: 0 },
        to: { opacity: 1 },
      },
      duration: duration.default,
      easing: easing.easeInOut,
    },
    hover: {
      transition: 'none',
      transform: 'none',
      boxShadow: 'none',
    },
  },
};
