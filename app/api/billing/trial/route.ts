import { NextRequest, NextResponse } from "next/server";
import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { PostHog } from "posthog-node";
import { z } from "zod";
import { getTierNameFromPriceId } from "@/lib/pricing/price-utils";

interface TrialStartResponse {
  status: "ok";
  trialEndsAt: string;
  subscriptionId: string;
}

interface ErrorResponse {
  error: string;
}

// Optional body schema for anonymous session upgrade
const trialBodySchema = z.object({
  anonymousSessionId: z.string().optional(),
  priceId: z.string().optional(),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse<TrialStartResponse | ErrorResponse>> {
  try {
    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!(await checkRateLimit(ip))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Check authentication
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be authenticated to start a trial" },
        { status: 401 }
      );
    }

    // Parse optional body
    let body = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Body is optional, ignore parse errors
    }

    const parsedBody = trialBodySchema.safeParse(body);
    const anonymousSessionId = parsedBody.success ? parsedBody.data.anonymousSessionId : undefined;

    // Step 1: Check for existing active subscription (authoritative check)
    const { data: existingActiveSubscription, error: activeSubError } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (activeSubError) {
      console.error(`[Trial] Error checking active subscription for user ${user.id}:`, activeSubError);
      // Continue - don't block on query errors, but log for investigation
    }

    if (existingActiveSubscription) {
      console.log(
        `[Trial] User ${user.id} already has active subscription: ${existingActiveSubscription.status}, subscription_id: ${existingActiveSubscription.stripe_subscription_id}`
      );
      return NextResponse.json(
        { error: "You already have an active subscription" },
        { status: 400 }
      );
    }

    // Step 2: Check subscription history to determine if trial was actually used
    const { data: subscriptionHistory, error: historyError } = await supabase
      .from("user_subscriptions")
      .select("id, status, trial_ends_at, created_at, stripe_subscription_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    if (historyError) {
      console.error(`[Trial] Error checking subscription history for user ${user.id}:`, historyError);
      // Continue - don't block on query errors
    }

    // Determine if user has actually used a trial based on subscription history
    const hasUsedTrialFromHistory =
      subscriptionHistory &&
      subscriptionHistory.length > 0 &&
      subscriptionHistory.some((sub) => {
        // User has used trial if:
        // 1. They have a subscription with trial_ends_at set (trial was created)
        // 2. Status is not currently trialing (trial ended or converted)
        return (
          sub.trial_ends_at !== null &&
          sub.status !== "trialing" &&
          (sub.status === "active" ||
            sub.status === "canceled" ||
            sub.status === "past_due" ||
            sub.status === "unpaid" ||
            sub.status === "incomplete" ||
            sub.status === "incomplete_expired")
        );
      });

    if (hasUsedTrialFromHistory) {
      const trialSub = subscriptionHistory!.find((sub) => sub.trial_ends_at !== null);
      console.log(
        `[Trial] User ${user.id} has used trial (found in history): status=${trialSub?.status}, trial_ends_at=${trialSub?.trial_ends_at}, subscription_id=${trialSub?.stripe_subscription_id}`
      );
      return NextResponse.json(
        { error: "You have already used your free trial" },
        { status: 400 }
      );
    }

    // Step 3: Check metadata as advisory (less reliable, but useful for edge cases)
    const hasUsedTrialMetadata = user.user_metadata?.has_used_trial === true;

    if (hasUsedTrialMetadata) {
      if (!subscriptionHistory || subscriptionHistory.length === 0) {
        // Metadata says trial was used but no subscription record exists
        // This suggests a previous failed attempt - log warning and clear metadata
        console.warn(
          `[Trial] User ${user.id} has has_used_trial=true metadata but no subscription history. Clearing incorrect metadata to allow retry.`
        );
        // Clear the incorrect metadata flag
        const { error: clearError } = await supabase.auth.updateUser({
          data: { has_used_trial: false },
        });
        if (clearError) {
          console.error(
            `[Trial] Failed to clear incorrect metadata for user ${user.id}:`,
            clearError
          );
        } else {
          console.log(`[Trial] Cleared incorrect has_used_trial metadata for user ${user.id}`);
        }
        // Continue - allow user to proceed
      } else {
        // Metadata and database both indicate trial was used
        console.log(
          `[Trial] User ${user.id} has has_used_trial=true metadata and subscription history. Rejecting trial request.`
        );
        return NextResponse.json(
          { error: "You have already used your free trial" },
          { status: 400 }
        );
      }
    }

    // Log eligibility check result
    console.log(
      `[Trial] User ${user.id} is eligible for trial: hasActiveSub=${!!existingActiveSubscription}, hasHistory=${!!(subscriptionHistory && subscriptionHistory.length > 0)}, hasMetadata=${hasUsedTrialMetadata}`
    );

    // Create or retrieve Stripe customer
    const stripeService = new StripeService();
    console.log(`[Trial] Creating/retrieving Stripe customer for user ${user.id}`);
    const customer = await stripeService.createOrRetrieveCustomer(user.id, user.email!);

    // Get default price ID for Pro tier (most popular)
    const priceId =
      parsedBody.success && parsedBody.data.priceId
        ? parsedBody.data.priceId
        : process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY || "price_pro_monthly";

    console.log(
      `[Trial] Creating trial subscription for user ${user.id}, customer ${customer.id}, price ${priceId}`
    );

    // Create trial subscription in Stripe
    const subscription = await stripeService.createTrialSubscription({
      customerId: customer.id,
      priceId,
      trialDays: 14,
      userId: user.id,
    });

    // Calculate trial end date
    const trialEndsAt = new Date(subscription.trial_end! * 1000).toISOString();

    console.log(
      `[Trial] Trial subscription created in Stripe: ${subscription.id}, status: ${subscription.status}, trial_ends_at: ${trialEndsAt}`
    );

    // Save subscription to database FIRST (before updating metadata)
    // This ensures we have a record even if metadata update fails
    const { error: insertError } = await supabase.from("user_subscriptions").insert({
      user_id: user.id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      plan_id: null, // Will be set when trial converts
      status: "trialing",
      current_period_start: new Date().toISOString(),
      current_period_end: trialEndsAt,
      trial_ends_at: trialEndsAt,
    });

    if (insertError) {
      console.error(
        `[Trial] Failed to insert subscription to database for user ${user.id}:`,
        insertError
      );
      // Don't fail the request - subscription exists in Stripe
      // But log the error for investigation
    } else {
      console.log(
        `[Trial] Successfully saved subscription to database for user ${user.id}, subscription_id: ${subscription.id}`
      );
    }

    // Update user metadata to mark trial as used (after successful DB insert)
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { has_used_trial: true },
    });

    if (metadataError) {
      console.error(
        `[Trial] Failed to update user metadata for user ${user.id}:`,
        metadataError
      );
      // Don't fail the request - subscription is created and saved to DB
      // Metadata is less critical than the actual subscription record
    } else {
      console.log(`[Trial] Successfully updated has_used_trial metadata for user ${user.id}`);
    }

    // Track analytics event
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (posthogKey) {
      const posthog = new PostHog(posthogKey, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
      });

      await posthog.capture({
        distinctId: user.id,
        event: "trial_started",
        properties: {
          email: user.email,
          trial_days: 14,
          price_id: priceId,
          tier_name: getTierNameFromPriceId(priceId),
          from_anonymous: !!anonymousSessionId,
          anonymous_session_id: anonymousSessionId,
        },
      });

      await posthog.shutdown();
    }

    return NextResponse.json(
      {
        status: "ok",
        trialEndsAt,
        subscriptionId: subscription.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[Trial] Trial creation error:`, error);

    // More specific error messages for debugging
    if (error instanceof Error) {
      console.error(`[Trial] Error details: message="${error.message}", stack="${error.stack}"`);

      if (error.message.includes("STRIPE_SECRET_KEY")) {
        console.error(`[Trial] Stripe secret key not configured`);
        return NextResponse.json(
          { error: "Payment system not configured. Please contact support." },
          { status: 503 }
        );
      }
      if (error.message.includes("Price")) {
        console.error(`[Trial] Invalid price ID in request`);
        return NextResponse.json(
          { error: "Invalid subscription plan. Please try again." },
          { status: 400 }
        );
      }
    }

    // Log full error context for debugging
    console.error(`[Trial] Unhandled error during trial creation:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to start trial. Please try again." },
      { status: 500 }
    );
  }
}
