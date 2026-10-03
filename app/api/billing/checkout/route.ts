import { NextRequest, NextResponse } from "next/server";
import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { z } from "zod";

interface CheckoutSessionResponse {
  url: string;
}

interface ErrorResponse {
  error: string;
}

const checkoutSchema = z
  .object({
    // Client-provided key to make checkout session creation idempotent across retries/double-clicks.
    // Should be stable for the *same* user action (e.g. a UUID stored in a ref).
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict();

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
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }

    const { idempotencyKey } = parse.data;
    const priceId = process.env.STRIPE_PRICE_PMLE_PASS;
    if (!priceId) {
      return NextResponse.json({ error: "PMLE Pass price is not configured" }, { status: 500 });
    }
    const stripeService = new StripeService();

    // Create or retrieve Stripe customer
    const customer = await stripeService.createOrRetrieveCustomer(user.id, user.email!);

    // Create checkout session
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const stripeIdempotencyKey = idempotencyKey
      ? `${user.id}:${priceId}:${idempotencyKey}`
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
