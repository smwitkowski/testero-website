import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPaidAccess } from "@/lib/billing/paid-access";
import type { SubscriptionStatus } from "@/lib/billing/subscription-status";

export type BillingStatusResponse = {
  /** Compatibility alias for paid access, including one-time passes. */
  isSubscriber: boolean;
  status: SubscriptionStatus;
  accessType: "pass" | "legacy_subscription" | null;
  accessUntil: string | null;
  canManageSubscription: boolean;
};

const noAccess: BillingStatusResponse = {
  isSubscriber: false,
  status: "none",
  accessType: null,
  accessUntil: null,
  canManageSubscription: false,
};

/** UI metadata only. All authorization uses getPaidAccess on the server. */
export async function GET(): Promise<NextResponse<BillingStatusResponse>> {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json(noAccess);

    const access = await getPaidAccess(user.id);
    // Preserve legacy status for billing UI, without exposing Stripe identifiers.
    // Even canceled/past_due legacy customers may need to manage existing billing.
    // Valid pass holders can still manage any separate legacy subscription here.
    let legacyStatus: SubscriptionStatus = access.isLegacySubscriber ? "active" : "none";
    let canManageSubscription = false;
    try {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("status, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", user.id)
        .not("stripe_subscription_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        if (!access.isLegacySubscriber) legacyStatus = data.status as SubscriptionStatus;
        canManageSubscription = Boolean(data.stripe_customer_id && data.stripe_subscription_id);
      }
    } catch {
      // Metadata failures never elevate or remove verified paid access.
    }

    return NextResponse.json({
      isSubscriber: access.hasPaidAccess,
      status: legacyStatus,
      accessType: access.pass ? "pass" : access.isLegacySubscriber ? "legacy_subscription" : null,
      accessUntil: access.accessUntil,
      canManageSubscription,
    });
  } catch (error) {
    console.error("Error fetching billing status:", error);
    return NextResponse.json(noAccess);
  }
}
