// Beta onboarding flow constants for easy iteration
export const BETA_ONBOARDING_COPY = {
  welcome: {
    headline: "You're in — let's kick off your beta journey.",
    body: "We've unlocked beta features for your account. Start with a ~20-minute diagnostic to map your strengths and focus areas for the PMLE.",
    ctaPrimary: "Start Diagnostic",
    ctaSecondary: "Skip for now",
    timeEstimate: "~20 min",
  },
  
  // A/B Test Variants
  variants: {
    A: {
      ctaPrimary: "Start Diagnostic",
      incentiveText: null,
      progressDescription: "Your diagnostic will help us create a personalized study plan based on your current knowledge.",
      skipBanner: {
        message: "Finish your diagnostic to unlock a personalized study plan.",
        cta: "Start now",
      }
    },
    B: {
      ctaPrimary: "Start Diagnostic & Earn $20",
      incentiveText: "Complete the diagnostic + quick feedback to earn your $20 gift card.",
      progressDescription: "Your diagnostic will help us create a personalized study plan based on your current knowledge. Plus, you'll earn a $20 gift card for completing it!",
      skipBanner: {
        message: "Finish your diagnostic to unlock your personalized study plan and earn your $20 gift card.",
        cta: "Start now & earn $20",
      }
    }
  },
  
  errors: {
    noBetaAccess: "Beta access isn't enabled for this account.",
    sessionCreateFailed: "We couldn't start your diagnostic. Please try again.",
  },
  
  progressSteps: [
    "Start diagnostic",
    "Review plan", 
    "Explore question bank"
  ]
} as const;

// Feature flag for the onboarding flow
export const FEATURE_FLAGS = {
  BETA_ONBOARDING_FLOW: process.env.NEXT_PUBLIC_BETA_ONBOARDING_FLOW === 'true'
} as const;

// Helper function to get variant-specific content
export function getBetaVariantContent(variant: 'A' | 'B' | null = 'A') {
  const effectiveVariant = variant === 'B' ? 'B' : 'A';
  return BETA_ONBOARDING_COPY.variants[effectiveVariant];
}

// Helper function to determine if user should see gift card incentive
export function shouldShowGiftCardIncentive(variant: 'A' | 'B' | null = 'A'): boolean {
  return variant === 'B';
}