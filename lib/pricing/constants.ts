// Comprehensive pricing configuration based on revenue model

// Runtime validation for required environment variables
const validatePriceIds = () => {
  const requiredPriceIds = [
    {
      key: "NEXT_PUBLIC_STRIPE_BASIC_MONTHLY",
      value: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY,
    },
    { key: "NEXT_PUBLIC_STRIPE_PRO_MONTHLY", value: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY },
    {
      key: "NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY",
      value: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY,
    },
    // Exam package price IDs
    { key: "NEXT_PUBLIC_STRIPE_EXAM_3MONTH", value: process.env.NEXT_PUBLIC_STRIPE_EXAM_3MONTH },
    { key: "NEXT_PUBLIC_STRIPE_EXAM_6MONTH", value: process.env.NEXT_PUBLIC_STRIPE_EXAM_6MONTH },
    { key: "NEXT_PUBLIC_STRIPE_EXAM_12MONTH", value: process.env.NEXT_PUBLIC_STRIPE_EXAM_12MONTH },
  ];

  // Optional price IDs (for backward compatibility with existing subscriptions)
  const optionalPriceIds = [
    { key: "NEXT_PUBLIC_STRIPE_BASIC_3MONTH", value: process.env.NEXT_PUBLIC_STRIPE_BASIC_3MONTH },
    { key: "NEXT_PUBLIC_STRIPE_PRO_3MONTH", value: process.env.NEXT_PUBLIC_STRIPE_PRO_3MONTH },
    { key: "NEXT_PUBLIC_STRIPE_ALL_ACCESS_3MONTH", value: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_3MONTH },
  ];

  const missingRequired = requiredPriceIds.filter(({ value }) => !value);
  const missingOptional = optionalPriceIds.filter(({ value }) => !value);

  if (missingRequired.length > 0) {
    // Only log warning, never throw during module initialization
    console.warn(
      `Missing required Stripe price IDs:`,
      missingRequired.map(({ key }) => key)
    );
  }

  if (missingOptional.length > 0) {
    // Log info about optional price IDs (for backward compatibility)
    console.info(
      `Optional Stripe price IDs not set (for backward compatibility):`,
      missingOptional.map(({ key }) => key)
    );
  }
};

// Only validate in browser context, not during build or SSR
if (typeof window !== "undefined") {
  validatePriceIds();
}

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  threeMonthPrice: number;
  monthlyPriceId?: string;
  threeMonthPriceId?: string;
  features: string[];
  highlighted?: string[];
  recommended?: boolean;
  savingsPercentage?: number;
  isHidden?: boolean;
}

export interface ExamPackage {
  id: string;
  duration: string;
  months: number;
  price: number;
  priceId?: string;
  features: string[];
}

// Annual subscription tiers from revenue model
export const SUBSCRIPTION_TIERS: PricingTier[] = [
  {
    id: "basic",
    name: "PMLE Prep",
    description: "Focused preparation for the Google PMLE exam",
    monthlyPrice: 15,
    threeMonthPrice: 39.99, // Kept for backward compatibility with existing subscriptions
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY,
    threeMonthPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_3MONTH, // Kept for backward compatibility
    features: [
      "Full PMLE question bank (200+ questions)",
      "Realistic scenario-based questions",
      "Detailed explanations for every answer",
      "Domain-level readiness breakdown",
      "Practice on your weak areas",
      "Progress tracking",
    ],
    highlighted: ["Full PMLE question bank", "Domain-level readiness breakdown"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Most popular for serious learners",
    monthlyPrice: 59,
    threeMonthPrice: 549 / 4, // placeholder; adjust when Pro is re-enabled
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY,
    threeMonthPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_3MONTH,
    features: [
      "3 certification tracks",
      "All practice modes",
      "Advanced analytics",
      "Adaptive learning paths",
      "Spaced repetition",
      "Priority support",
      "Early access to new features",
      "Detailed explanations",
      "Performance insights",
    ],
    highlighted: ["3 certification tracks", "Adaptive practice modes", "Advanced analytics"],
    recommended: true,
    // Hidden tier; savings not relevant, but keep structure consistent
    savingsPercentage: 0,
    isHidden: true,
  },
  {
    id: "all-access",
    name: "All-Access",
    description: "Ultimate learning experience",
    monthlyPrice: 79,
    threeMonthPrice: 749 / 4, // placeholder; adjust when All-Access is re-enabled
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY,
    threeMonthPriceId: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_3MONTH,
    features: [
      "All certifications",
      "Unlimited tracks",
      "Team features",
      "API access",
      "Custom study plans",
      "1-on-1 coaching session",
      "Exclusive content",
      "White-glove support",
      "Bulk question generation",
      "Export capabilities",
    ],
    highlighted: ["All certifications", "Unlimited practice modes", "Team features"],
    savingsPercentage: 0,
    isHidden: true,
  },
];

// One-time exam packages
export const EXAM_PACKAGES: ExamPackage[] = [
  {
    id: "3-month",
    duration: "3-Month Access",
    months: 3,
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_EXAM_3MONTH,
    features: ["Full exam content", "Unlimited core practice exams", "Progress tracking", "Basic analytics"],
  },
  {
    id: "6-month",
    duration: "6-Month Access",
    months: 6,
    price: 149,
    priceId: process.env.NEXT_PUBLIC_STRIPE_EXAM_6MONTH,
    features: [
      "Full exam content",
      "Adaptive practice and domain drills",
      "Progress tracking",
      "Advanced analytics",
      "Priority support",
    ],
  },
  {
    id: "12-month",
    duration: "12-Month Access",
    months: 12,
    price: 199,
    priceId: process.env.NEXT_PUBLIC_STRIPE_EXAM_12MONTH,
    features: [
      "Full exam content",
      "Unlimited practice modes",
      "Progress tracking",
      "Advanced analytics",
      "Priority support",
      "Exam retake coverage",
    ],
  },
];

import { MICROCOPY, TRUST_SIGNALS } from "@/lib/copy/message-house";

// Value propositions for pricing page
export const VALUE_PROPS = {
  mainHeadline: "Know Your Readiness Before You Book",
  subHeadline:
    "Start without an account. Create a free account to view and save results. Paid unlocks explanations and more practice.",
  guarantees: [
    MICROCOPY.moneyBackGuarantee,
    "Content aligned to current exam guide",
  ],
  trustBadges: TRUST_SIGNALS,
  valueAnchors: {
    examCost: `Know your readiness before you pay the exam fee`,
    time: "Stop wasting study time on the wrong topics",
    success: "Start with a free diagnostic to see where you stand",
  },
};

// Comparison table data
export const FEATURE_COMPARISON = [
  {
    category: "Core Features",
    features: [
      { name: "PMLE Question Bank", basic: "200+ questions" },
      { name: "Realistic Scenario Questions", basic: true },
      { name: "Detailed Explanations", basic: true },
      { name: "Diagnostic Tests", basic: true },
      { name: "Domain-Level Readiness", basic: true },
      { name: "Progress Tracking", basic: true },
    ],
  },
  {
    category: "Practice & Study",
    features: [
      { name: "Practice on Weak Areas", basic: true },
      { name: "Scenario-Based Questions", basic: true },
      { name: "Documentation-Grounded Explanations", basic: true },
    ],
  },
];

// FAQ data for pricing page
export const PRICING_FAQ = [
  {
    question: "Do you offer refunds?",
    answer:
      "Yes — 7-day no-questions-asked refund.",
  },
  {
    question: "Why is Testero better than free practice questions?",
    answer:
      "Because free questions are outdated, don't follow the blueprint, and don't tell you what to study next. Testero does.",
  },
    {
      question: "Will the questions match the real PMLE exam?",
      answer:
        "Yes. All content is aligned with the current PMLE exam blueprint. Questions are designed to reflect the exam format and topics that actually appear on the test.",
    },
  {
    question: "Is this an official Google product?",
    answer:
      "No — Testero is independent.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes! You can cancel your subscription at any time. Your access will continue until the end of your current billing period.",
  },
];

// Testimonials for pricing page
export const PRICING_TESTIMONIALS: Array<{
  quote: string;
  author: string;
  role: string;
  certification: string;
  tier: string;
}> = [];
