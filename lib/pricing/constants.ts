// Comprehensive pricing configuration based on revenue model

// Runtime validation for required environment variables
const validatePriceIds = () => {
  const requiredPriceIds = [
    {
      key: "NEXT_PUBLIC_STRIPE_BASIC_MONTHLY",
      value: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY,
    },
    { key: "NEXT_PUBLIC_STRIPE_BASIC_ANNUAL", value: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL },
    { key: "NEXT_PUBLIC_STRIPE_PRO_MONTHLY", value: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY },
    { key: "NEXT_PUBLIC_STRIPE_PRO_ANNUAL", value: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL },
    {
      key: "NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY",
      value: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY,
    },
    {
      key: "NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL",
      value: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL,
    },
    // Exam package price IDs
    { key: "NEXT_PUBLIC_STRIPE_EXAM_3MONTH", value: process.env.NEXT_PUBLIC_STRIPE_EXAM_3MONTH },
    { key: "NEXT_PUBLIC_STRIPE_EXAM_6MONTH", value: process.env.NEXT_PUBLIC_STRIPE_EXAM_6MONTH },
    { key: "NEXT_PUBLIC_STRIPE_EXAM_12MONTH", value: process.env.NEXT_PUBLIC_STRIPE_EXAM_12MONTH },
  ];

  const missingIds = requiredPriceIds.filter(({ value }) => !value);

  if (missingIds.length > 0) {
    // Only log warning, never throw during module initialization
    console.warn(
      `Missing Stripe price IDs:`,
      missingIds.map(({ key }) => key)
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
  annualPrice: number;
  monthlyPriceId?: string;
  annualPriceId?: string;
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
    name: "PMLE Readiness",
    description: "Everything you need to pass the Google PMLE exam",
    monthlyPrice: 39,
    annualPrice: 349,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL,
    features: [
      "1 certification track",
      "Core practice questions",
      "Basic analytics dashboard",
      "Progress tracking",
      "Mobile access",
      "Email support",
    ],
    highlighted: ["1 certification track", "Core practice questions"],
    savingsPercentage: 25,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Most popular for serious learners",
    monthlyPrice: 59,
    annualPrice: 549,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL,
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
    savingsPercentage: 23,
    isHidden: true,
  },
  {
    id: "all-access",
    name: "All-Access",
    description: "Ultimate learning experience",
    monthlyPrice: 79,
    annualPrice: 749,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL,
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
    savingsPercentage: 21,
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

// Value propositions for pricing page
export const VALUE_PROPS = {
  mainHeadline: "Master the Google PMLE Exam",
  subHeadline:
    "Diagnostic-first readiness assessment with documentation-grounded explanations to help you pass the Professional Machine Learning Engineer certification",
  guarantees: [
    "7-day money-back guarantee",
    "Content regularly updated to match exam blueprint",
  ],
  trustBadges: [
    "PMLE-Focused",
    "Diagnostic-First",
    "Detailed Explanations",
    "Mobile Access",
  ],
  valueAnchors: {
    examCost: "Invest $149 to protect your $300 exam fee",
    salary: "PMLE-certified professionals earn $150k+ on average",
    time: "Diagnostic test identifies your weak areas for focused study",
    success: "Start with a free diagnostic to assess your readiness",
  },
};

// Comparison table data
export const FEATURE_COMPARISON = [
  {
    category: "Core Features",
    features: [
      { name: "Practice Questions", basic: "500+", pro: "2,000+", allAccess: "Unlimited" },
      { name: "Certification Tracks", basic: "1", pro: "3", allAccess: "All" },
      { name: "Practice Exams", basic: "Unlimited core", pro: "Adaptive + domain", allAccess: "All modes" },
      { name: "Diagnostic Tests", basic: true, pro: true, allAccess: true },
      { name: "Progress Tracking", basic: true, pro: true, allAccess: true },
    ],
  },
  {
    category: "Advanced Features",
    features: [
      { name: "Adaptive Learning", basic: false, pro: true, allAccess: true },
      { name: "Spaced Repetition", basic: false, pro: true, allAccess: true },
      { name: "Performance Analytics", basic: "Basic", pro: "Advanced", allAccess: "Premium" },
      { name: "Custom Study Plans", basic: false, pro: false, allAccess: true },
      { name: "Team Features", basic: false, pro: false, allAccess: true },
    ],
  },
  {
    category: "Support & Resources",
    features: [
      { name: "Support", basic: "Email", pro: "Priority", allAccess: "White-glove" },
      { name: "Response Time", basic: "48h", pro: "24h", allAccess: "2h" },
      { name: "1-on-1 Coaching", basic: false, pro: false, allAccess: "1 session" },
      { name: "Exclusive Content", basic: false, pro: "Early access", allAccess: true },
      { name: "API Access", basic: false, pro: false, allAccess: true },
    ],
  },
];

// FAQ data for pricing page
export const PRICING_FAQ = [
  {
    question: "Can I change my subscription?",
    answer:
      "Yes! You can cancel or modify your subscription at any time. Changes are prorated, so you only pay for what you use.",
  },
  {
    question: "How many practice exams can I take?",
    answer:
      "Free users get access to a diagnostic test and limited practice questions. Paid plans include unlimited practice questions with detailed explanations.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Absolutely. We offer a 7-day money-back guarantee. If you're not satisfied, contact us within 7 days for a full refund, no questions asked.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "We offer a free diagnostic test and limited practice questions. This lets you experience our platform before committing to a paid plan.",
  },
  {
    question: "How often is the content updated?",
    answer:
      "We regularly update our content to match the latest PMLE exam blueprint and ensure our questions reflect current Google Cloud documentation.",
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
