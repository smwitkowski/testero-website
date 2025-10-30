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
  aiCredits: number;
  features: string[];
  highlighted?: string[];
  recommended?: boolean;
  savingsPercentage?: number;
}

export interface ExamPackage {
  id: string;
  duration: string;
  months: number;
  price: number;
  priceId?: string;
  aiCredits: number;
  features: string[];
}

// Annual subscription tiers from revenue model
export const SUBSCRIPTION_TIERS: PricingTier[] = [
  {
    id: "basic",
    name: "Basic",
    description: "Perfect for focused certification prep",
    monthlyPrice: 39,
    annualPrice: 349,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL,
    aiCredits: 5,
    features: [
      "1 certification track",
      "Core practice questions",
      "Basic analytics dashboard",
      "Progress tracking",
      "Mobile access",
      "Email support",
    ],
    highlighted: ["1 certification track", "5 AI credits/month"],
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
    aiCredits: 20,
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
    highlighted: ["3 certification tracks", "20 AI credits/month", "Advanced analytics"],
    recommended: true,
    savingsPercentage: 23,
  },
  {
    id: "all-access",
    name: "All-Access",
    description: "Ultimate learning experience",
    monthlyPrice: 79,
    annualPrice: 749,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL,
    aiCredits: 50,
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
    highlighted: ["All certifications", "50 AI credits/month", "Team features"],
    savingsPercentage: 21,
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
    aiCredits: 10,
    features: ["Full exam content", "10 AI practice exams", "Progress tracking", "Basic analytics"],
  },
  {
    id: "6-month",
    duration: "6-Month Access",
    months: 6,
    price: 149,
    priceId: process.env.NEXT_PUBLIC_STRIPE_EXAM_6MONTH,
    aiCredits: 25,
    features: [
      "Full exam content",
      "25 AI practice exams",
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
    aiCredits: 50,
    features: [
      "Full exam content",
      "50 AI practice exams",
      "Progress tracking",
      "Advanced analytics",
      "Priority support",
      "Exam retake coverage",
    ],
  },
];

// AI Credit pricing and usage
export const AI_CREDIT_USAGE = {
  fullExam: 1,
  domainQuiz: 0.5,
  explanation: 0.2,
  additionalCreditPrice: 2,
  bulkDiscounts: [
    { credits: 10, price: 18, discount: 10 },
    { credits: 25, price: 40, discount: 20 },
    { credits: 50, price: 75, discount: 25 },
  ],
};

// Value propositions for pricing page
export const VALUE_PROPS = {
  mainHeadline: "Pass Your Certification 15% Faster—Guaranteed",
  subHeadline:
    "Join 5,000+ professionals who passed on their first attempt with AI-powered adaptive learning",
  guarantees: [
    "7-day money-back guarantee",
    "Pass guarantee or get 3 months free",
    "Content updated within 14 days of exam changes",
  ],
  trustBadges: [
    "5,000+ Professionals Certified",
    "92% First-Attempt Pass Rate",
    "4.8/5 Average Rating",
    "Updated Weekly",
  ],
  valueAnchors: {
    examCost: "Invest $149 to protect your $300 exam fee",
    salary: "PMLE-certified professionals earn $150k+ on average",
    time: "Save 40% study time with AI-personalized paths",
    success: "Join 5,000+ professionals who passed on first attempt",
  },
};

// Comparison table data
export const FEATURE_COMPARISON = [
  {
    category: "Core Features",
    features: [
      { name: "Practice Questions", basic: "500+", pro: "2,000+", allAccess: "Unlimited" },
      { name: "Certification Tracks", basic: "1", pro: "3", allAccess: "All" },
      { name: "AI Credits/Month", basic: "5", pro: "20", allAccess: "50" },
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
    question: "Can I switch between plans?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. Changes are prorated, so you only pay for what you use.",
  },
  {
    question: "What happens when I run out of AI credits?",
    answer:
      "You can purchase additional credits at $2 per credit, or upgrade to a higher tier for better value. Basic practice questions don't require credits.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Absolutely. We offer a 7-day money-back guarantee. If you're not satisfied, contact us within 7 days for a full refund, no questions asked.",
  },
  {
    question: "What's included in the pass guarantee?",
    answer:
      "If you complete 80% of your personalized study plan and don't pass your exam, we'll give you 3 additional months free to prepare for your retake.",
  },
  {
    question: "Can I pause my subscription?",
    answer:
      "Yes, you can pause your subscription for up to 3 months if you need to take a break. Your progress and credits will be saved.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "We offer a free diagnostic test and limited practice questions. This lets you experience our platform before committing to a paid plan.",
  },
  {
    question: "How often is the content updated?",
    answer:
      "We update our content within 14 days of any exam blueprint changes. Our AI continuously generates new questions to keep your practice fresh.",
  },
  {
    question: "Can my company purchase team licenses?",
    answer:
      "Yes! Contact us for enterprise pricing. We offer volume discounts, admin dashboards, and custom integration options for teams of 5+.",
  },
];

// Testimonials for pricing page
export const PRICING_TESTIMONIALS = [
  {
    quote:
      "The Pro plan paid for itself when I passed PMLE on my first try. The adaptive learning saved me at least 40 hours of study time.",
    author: "Sarah Chen",
    role: "ML Engineer at Google",
    certification: "Google PMLE",
    tier: "Pro",
  },
  {
    quote:
      "Started with Basic for my PCA cert, upgraded to All-Access and passed 3 certs in 6 months. Best career investment I've made.",
    author: "Michael Rodriguez",
    role: "Cloud Architect",
    certification: "Multiple GCP Certs",
    tier: "All-Access",
  },
  {
    quote:
      "The 6-month exam package was perfect. Enough time to study at my pace, and the 25 AI credits were exactly what I needed.",
    author: "Jennifer Park",
    role: "DevOps Engineer",
    certification: "Google ACE",
    tier: "6-Month Package",
  },
];
