import { MICROCOPY, TRUST_SIGNALS } from "@/lib/copy/message-house";

/** The only offer for new purchases. Stripe configuration stays on the server. */
export const PMLE_PASS = {
  name: "PMLE Pass",
  price: 39,
  durationDays: 90,
  refundDays: 7,
} as const;

export type PmlePass = typeof PMLE_PASS;

export const PMLE_PASS_FEATURES = [
  "Full PMLE question bank",
  "Unlimited PMLE practice",
  "Detailed explanations for every answer",
  "Domain-level readiness insights",
  "Practice on your weak areas",
  "Progress tracking",
] as const;

export const VALUE_PROPS = {
  mainHeadline: "Know Your Readiness Before You Book",
  subHeadline: "PMLE Pass: US$39 once for 90 days of full PMLE access. No subscription. No automatic renewal.",
  guarantees: [MICROCOPY.moneyBackGuarantee, "Content aligned to current exam guide"],
  trustBadges: TRUST_SIGNALS,
  valueAnchors: {
    examCost: "Know your readiness before you pay the exam fee",
    time: "Focus your study time on the right topics",
    success: "Start with a free diagnostic to see where you stand",
  },
};

export const FEATURE_COMPARISON = [
  {
    category: "PMLE Pass includes",
    features: PMLE_PASS_FEATURES.map((name) => ({ name, pass: true })),
  },
];

export const PRICING_FAQ = [
  {
    question: "What does PMLE Pass cost?",
    answer: "US$39 as a one-time payment for 90 days of full PMLE access. There is no subscription or automatic renewal.",
  },
  {
    question: "Do you offer refunds?",
    answer: "Request a refund within 7 days of purchase. A refund ends your PMLE Pass access.",
  },
  {
    question: "What happens after 90 days?",
    answer: "Your PMLE Pass access ends. You will not be charged again automatically.",
  },
  {
    question: "Can I try the diagnostic before buying?",
    answer: "Yes. Start a free diagnostic without an account. View your basic readiness summary without an account. Create a free account for question review and saved results. PMLE Pass adds explanations and full practice access.",
  },
  {
    question: "Is this an official Google product?",
    answer: "No. Testero is independent. Questions are designed around the current PMLE exam guide, not copied from the real exam.",
  },
  {
    question: "What if I already have a subscription?",
    answer: "Existing active subscriptions keep their access. You can manage your legacy subscription from the billing page.",
  },
];

export const PRICING_TESTIMONIALS: Array<{
  quote: string;
  author: string;
  role: string;
  certification: string;
  plan: string;
}> = [];
