/** Legacy status metadata. No trial status grants paid access. */
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
}

/** Legacy-only status helper. Use getPaidAccess for authorization. */
export function computeIsSubscriber(data: SubscriptionData | null): boolean {
  return data?.status === "active";
}
