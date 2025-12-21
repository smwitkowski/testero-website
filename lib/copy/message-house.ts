/**
 * Testero 2026 Message House & Copy Constants
 * 
 * Single source of truth for all marketing and product copy.
 * Aligned to: PMLE-first, readiness-first, balanced claims posture.
 * 
 * Last Updated: 2025-12-28
 */

/**
 * Core positioning statement (one-liner)
 */
export const CORE_POSITIONING = {
  headline: "Know your certification readiness. Fast.",
  subheadline: "Take a short diagnostic, see your weak areas, and get a focused plan for what to study next.",
};

/**
 * Three core value pillars
 */
export const VALUE_PILLARS = {
  readiness: {
    title: "Get a readiness baseline",
    description: "Know where you stand across the exam guide sections.",
    icon: "Target",
  },
  blueprint: {
    title: "Study the right topics",
    description: "Focus practice on your weakest areas instead of studying random questions.",
    icon: "FileText",
  },
  explanations: {
    title: "Learn from explanations (paid)",
    description: "Understand why an answer is correct, so you can transfer the skill on exam day.",
    icon: "BookOpen",
  },
};

/**
 * Approved vocabulary (use consistently across all surfaces)
 */
export const VOCABULARY = {
  diagnostic: "diagnostic" as const, // Never "test" or "exam" for the free entry
  readinessScore: "readiness score" as const,
  domainBreakdown: "domain breakdown" as const,
  explanations: "explanations" as const, // Paid feature
  targetedPractice: "targeted practice" as const, // Paid feature
  unlimitedPractice: "unlimited practice" as const, // Paid feature
  pmle: "PMLE" as const, // Always uppercase
  examFee: "$200" as const, // Standardized exam fee anchor
};

/**
 * CTA hierarchy (primary vs secondary)
 */
export const CTAS = {
  primary: {
    diagnostic: "Start free diagnostic",
    signup: "Sign up free",
    upgrade: "Upgrade to PMLE Readiness",
  },
  secondary: {
    viewPricing: "See pricing",
    viewExamples: "See example questions",
    maybeLater: "Maybe later",
  },
};

/**
 * Free vs Paid boundaries (must match entitlements)
 */
export const FREE_FEATURES = {
  diagnostic: "1 diagnostic per exam (PMLE)",
  basicSummary: "Basic readiness summary (score + domain breakdown)",
  limitedPractice: "Limited practice quota (5 questions/week)",
  noExplanations: true, // Explicitly no explanations
} as const;

export const PAID_FEATURES = {
  explanations: "Detailed explanations for every answer",
  unlimitedPractice: "Unlimited practice within PMLE",
  diagnosticRetakes: "Diagnostic retakes",
  readinessHistory: "Readiness history and progress tracking",
  domainTargeted: "Domain-targeted practice loops",
} as const;

/**
 * Claim register: Numeric claims, guarantees, SLAs
 * Each claim maps to: source, where used, qualification needed
 */
export interface Claim {
  claim: string;
  source: "provable" | "needs-qualifier" | "remove" | "blog-only";
  qualification?: string; // Required qualifier text if source is "needs-qualifier"
  usedIn: string[]; // File paths where this claim appears
}

export const CLAIM_REGISTER: Claim[] = [
  {
    claim: "14 days update SLA",
    source: "needs-qualifier",
    qualification: "Questions are designed to align with the current blueprint and are updated as the exam evolves.",
    usedIn: ["app/page.tsx", "components/marketing/sections/benefits-section.tsx"],
  },
  {
    claim: "85% pass rate",
    source: "remove",
    usedIn: ["components/marketing/sections/enhanced-social-proof.tsx", "components/marketing/sections/benefits-section.tsx"],
  },
  {
    claim: "70% fail rate",
    source: "blog-only",
    usedIn: ["app/page.tsx"],
  },
  {
    claim: "40+ hours saved",
    source: "remove",
    usedIn: ["components/marketing/sections/enhanced-social-proof.tsx", "components/marketing/sections/benefits-section.tsx"],
  },
  {
    claim: "Pass PMLE in 30 Days—Guaranteed",
    source: "remove",
    usedIn: ["app/page.tsx"],
  },
  {
    claim: "7-day money-back guarantee",
    source: "provable",
    usedIn: ["app/page.tsx", "app/pricing/page.tsx", "lib/pricing/constants.ts"],
  },
  {
    claim: "Free forever",
    source: "needs-qualifier",
    qualification: "Free diagnostic and limited practice. Explanations and unlimited practice require a subscription.",
    usedIn: ["components/marketing/sections/final-cta-section.tsx", "components/marketing/sections/benefits-section.tsx"],
  },
  {
    claim: "$200 exam fee",
    source: "provable",
    usedIn: ["app/page.tsx", "lib/pricing/constants.ts"],
  },
  {
    claim: "October 2024 exam updated",
    source: "needs-qualifier",
    qualification: "Aligned to October 2024 blueprint changes.",
    usedIn: ["app/page.tsx", "app/diagnostic/page.tsx"],
  },
];

/**
 * Scope claims (PMLE-only vs multi-cloud)
 */
export const SCOPE_CLAIMS = {
  pmleOnly: {
    primary: "PMLE-focused",
    description: "Everything you need for Cloud certification readiness, without wasted study time.",
  },
  multiCloud: {
    // Remove until actually supported
    description: "Supporting Google Cloud, AWS, and Azure certifications",
    status: "remove" as const,
  },
};

/**
 * Trust signals (provable, no qualifiers needed)
 */
export const TRUST_SIGNALS = [
  "PMLE-focused",
  "Diagnostic-first",
  "Blueprint-aligned",
  "Cancel anytime",
];

/**
 * Microcopy patterns
 */
export const MICROCOPY = {
  diagnosticTime: "5–10 minutes",
  noCreditCard: "No credit card required",
  instantResults: "Results instantly",
  cancelAnytime: "Cancel anytime",
  moneyBackGuarantee: "7-day money-back guarantee",
  heroMicrocopy: "Start without an account",
};

/**
 * Error/empty states
 */
export const EMPTY_STATES = {
  noDiagnostic: "Take your first diagnostic to see your readiness score.",
  noPractice: "Start practicing to track your progress.",
  noResults: "Complete a diagnostic to see your results.",
};

/**
 * Helper: Get qualified claim text
 */
export function getQualifiedClaim(claimText: string): string {
  const claim = CLAIM_REGISTER.find((c) => claimText.includes(c.claim));
  if (!claim || claim.source !== "needs-qualifier") {
    return claimText;
  }
  return `${claimText} ${claim.qualification || ""}`;
}

/**
 * Helper: Check if claim should be removed
 */
export function shouldRemoveClaim(claimText: string): boolean {
  const claim = CLAIM_REGISTER.find((c) => claimText.includes(c.claim));
  return claim?.source === "remove";
}

