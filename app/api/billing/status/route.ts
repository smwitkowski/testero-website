import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeIsSubscriber, type SubscriptionStatus } from "@/lib/billing/subscription-status";

export type BillingStatusResponse = {
  isSubscriber: boolean;
  status: SubscriptionStatus;
};

/**
 * GET /api/billing/status
 * Returns lightweight subscription status for UI decisions only.
 * Server remains authoritative for authorization.
 * No sensitive plan details (plan_id, Stripe IDs, amounts) are returned.
 */
export async function GET(request: NextRequest): Promise<NextResponse<BillingStatusResponse>> {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Unauthenticated users get default response
    if (authError || !user) {
      return NextResponse.json(
        {
          isSubscriber: false,
          status: "none",
        },
        { status: 200 }
      );
    }

    // Query subscription with minimal fields - get most recent subscription
    // First check for active/trialing subscriptions
    const { data: activeData, error: activeError } = await supabase
      .from("user_subscriptions")
      .select("status, trial_ends_at")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();

    // If found active/trialing, use it
    if (!activeError && activeData) {
      const isSubscriber = computeIsSubscriber(activeData);

      return NextResponse.json(
        {
          isSubscriber,
          status: activeData.status as BillingStatusResponse["status"],
        },
        { status: 200 }
      );
    }

    // If no active/trialing, check for any other subscription status
    const { data: anyData, error: anyError } = await supabase
      .from("user_subscriptions")
      .select("status, trial_ends_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // No subscription found at all
    if (anyError || !anyData) {
      return NextResponse.json(
        {
          isSubscriber: false,
          status: "none",
        },
        { status: 200 }
      );
    }

    // Return the status even if not active/trialing (for past_due, canceled, etc.)
    return NextResponse.json(
      {
        isSubscriber: false, // Non-active/trialing subscriptions are not subscribers
        status: anyData.status as BillingStatusResponse["status"],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching billing status:", error);
    // Fail gracefully - return non-subscriber status
    return NextResponse.json(
      {
        isSubscriber: false,
        status: "none",
      },
      { status: 200 }
    );
  }
}

