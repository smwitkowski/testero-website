// Pricing analytics helper functions
// Centralizes logic for extracting tier names, payment modes, and plan types from Stripe price IDs

/**
 * Determines if a price ID corresponds to an exam package (one-time payment)
 * vs a subscription tier (recurring payment)
 */
export function isExamPackagePrice(priceId: string): boolean {
  return [
    process.env.NEXT_PUBLIC_STRIPE_EXAM_3MONTH,
    process.env.NEXT_PUBLIC_STRIPE_EXAM_6MONTH,
    process.env.NEXT_PUBLIC_STRIPE_EXAM_12MONTH,
  ].includes(priceId);
}

/**
 * Returns the payment mode for a given price ID
 * - "payment" for one-time exam packages
 * - "subscription" for recurring subscription tiers
 */
export function getPaymentMode(priceId: string): "subscription" | "payment" {
  return isExamPackagePrice(priceId) ? "payment" : "subscription";
}

/**
 * Returns the plan type for a given price ID
 * - "exam_package" for one-time exam packages
 * - "subscription" for recurring subscription tiers
 */
export function getPlanType(priceId: string): "subscription" | "exam_package" {
  return isExamPackagePrice(priceId) ? "exam_package" : "subscription";
}

/**
 * Extracts the tier name from a Stripe price ID
 * Maps price IDs to human-readable tier names for analytics tracking
 *
 * @param priceId - The Stripe price ID to look up
 * @returns Tier name string (PMLE Readiness, Pro, All-Access, or exam package name, or "Unknown")
 */
export function getTierNameFromPriceId(priceId: string): string {
  // PMLE Readiness tier (formerly Basic)
  if (
    priceId === process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY ||
    priceId === process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL
  ) {
    return "PMLE Readiness";
  }

  // Pro tier
  if (
    priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY ||
    priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL
  ) {
    return "Pro";
  }

  // All-Access tier
  if (
    priceId === process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY ||
    priceId === process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_ANNUAL
  ) {
    return "All-Access";
  }

  // Exam packages
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_EXAM_3MONTH) {
    return "3-Month Package";
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_EXAM_6MONTH) {
    return "6-Month Package";
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_EXAM_12MONTH) {
    return "12-Month Package";
  }

  return "Unknown";
}

