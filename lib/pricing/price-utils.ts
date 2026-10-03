import { PMLE_PASS } from "./constants";

/** Public analytics describe the offer, never a Stripe price or billing interval. */
export function getPassAnalyticsProperties() {
  return {
    plan_name: PMLE_PASS.name,
    payment_mode: "payment" as const,
    plan_type: "pass" as const,
    price: PMLE_PASS.price,
    currency: "USD" as const,
    duration_days: PMLE_PASS.durationDays,
  };
}
