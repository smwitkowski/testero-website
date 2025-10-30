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

    // Check if user has already used trial
    const hasUsedTrial = user.user_metadata?.has_used_trial === true;
    if (hasUsedTrial) {
      return NextResponse.json({ error: "You have already used your free trial" }, { status: 400 });
    }

    // Check for existing active subscription
    const { data: existingSubscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .single();

    if (existingSubscription) {
      return NextResponse.json(
        { error: "You already have an active subscription" },
        { status: 400 }
      );
    }

    // Create or retrieve Stripe customer
    const stripeService = new StripeService();
    const customer = await stripeService.createOrRetrieveCustomer(user.id, user.email!);

    // Get default price ID for Pro tier (most popular)
    const priceId =
      parsedBody.success && parsedBody.data.priceId
        ? parsedBody.data.priceId
        : process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY || "price_pro_monthly";

    // Create trial subscription
    const subscription = await stripeService.createTrialSubscription({
      customerId: customer.id,
      priceId,
      trialDays: 14,
      userId: user.id,
    });

    // Calculate trial end date
    const trialEndsAt = new Date(subscription.trial_end! * 1000).toISOString();

    // Update user metadata to mark trial as used
    await supabase.auth.updateUser({
      data: { has_used_trial: true },
    });

    // Save subscription to database
    await supabase.from("user_subscriptions").insert({
      user_id: user.id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      plan_id: null, // Will be set when trial converts
      status: "trialing",
      current_period_start: new Date().toISOString(),
      current_period_end: trialEndsAt,
      trial_ends_at: trialEndsAt,
    });

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
    console.error("Trial creation error:", error);

    // More specific error messages for debugging
    if (error instanceof Error) {
      if (error.message.includes("STRIPE_SECRET_KEY")) {
        return NextResponse.json(
          { error: "Payment system not configured. Please contact support." },
          { status: 503 }
        );
      }
      if (error.message.includes("Price")) {
        return NextResponse.json(
          { error: "Invalid subscription plan. Please try again." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to start trial. Please try again." },
      { status: 500 }
    );
  }
}
