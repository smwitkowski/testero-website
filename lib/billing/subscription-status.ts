/**
 * Shared utilities for computing subscription status.
 * Used by both server-side authorization checks and client-side status API.
 */

export type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export interface SubscriptionData {
  status: SubscriptionStatus;
  trial_ends_at: string | null;
}

/**
 * Computes isSubscriber boolean from subscription data.
 * Active subscriptions always count. Trialing subscriptions only count if trial_ends_at is in the future.
 */
export function computeIsSubscriber(data: SubscriptionData | null): boolean {
  if (!data) return false;

  if (data.status === "active") {
    return true;
  }

  if (data.status === "trialing") {
    // Trialing only counts if trial_ends_at is in the future
    return !!data.trial_ends_at && new Date(data.trial_ends_at) > new Date();
  }

  return false;
}

