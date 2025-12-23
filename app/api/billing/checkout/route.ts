import { NextRequest, NextResponse } from "next/server";
import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { SUBSCRIPTION_TIERS } from "@/lib/pricing/constants";
import { z } from "zod";

interface CheckoutSessionResponse {
  url: string;
}

interface ErrorResponse {
  error: string;
}

const checkoutSchema = z.object({
  priceId: z.string().min(1),
  // Client-provided key to make checkout session creation idempotent across retries/double-clicks.
  // Should be stable for the *same* user action (e.g. a UUID stored in a ref).
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse<CheckoutSessionResponse | ErrorResponse>> {
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
      return NextResponse.json({ error: "You must be authenticated to checkout" }, { status: 401 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parse = checkoutSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
    }

    const { priceId, idempotencyKey } = parse.data;

    // Build list of all valid price IDs from pricing constants
    const validPrices: string[] = [];

    // Add subscription tier price IDs
    for (const tier of SUBSCRIPTION_TIERS) {
      if (tier.monthlyPriceId) validPrices.push(tier.monthlyPriceId);
      if (tier.threeMonthPriceId) validPrices.push(tier.threeMonthPriceId);
    }

    // Validate price ID against our configured prices
    if (!validPrices.includes(priceId)) {
      return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
    }

    // Create Stripe service instance
    const stripeService = new StripeService();

    // Check if user already has an active subscription (only for subscription prices)
    // Allow one-time payments even if user has active subscription
    const priceType = await stripeService.getPriceType(priceId);

    if (priceType === "subscription") {
      const { data: existingSubscription } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (existingSubscription) {
        return NextResponse.json(
          { error: "You already have an active subscription" },
          { status: 400 }
        );
      }
    }

    // Create or retrieve Stripe customer
    const customer = await stripeService.createOrRetrieveCustomer(user.id, user.email!);

    // Create checkout session
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const headerIdempotencyKey = request.headers.get("x-idempotency-key") || undefined;
    const mergedIdempotencyKey = headerIdempotencyKey || idempotencyKey;
    const stripeIdempotencyKey = mergedIdempotencyKey
      ? `${user.id}:${priceId}:${mergedIdempotencyKey}`
      : undefined;
    const session = await stripeService.createCheckoutSession({
      customerId: customer.id,
      priceId,
      successUrl: `${siteUrl}/api/billing/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl}/pricing`,
      userId: user.id,
      idempotencyKey: stripeIdempotencyKey,
    });

    return NextResponse.json({ url: session.url || "" }, { status: 200 });
  } catch (error) {
    console.error("Checkout session creation error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
