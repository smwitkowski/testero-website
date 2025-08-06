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

const checkoutSchema = z.object({
  priceId: z.string().min(1),
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

    const { priceId } = parse.data;

    // Validate price ID against our configured prices
    const validPrices = [process.env.STRIPE_PRICE_ID_MONTHLY, process.env.STRIPE_PRICE_ID_YEARLY];

    if (!validPrices.includes(priceId)) {
      return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
    }

    // Check if user already has an active subscription
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

    // Create or retrieve Stripe customer
    const stripeService = new StripeService();
    const customer = await stripeService.createOrRetrieveCustomer(user.id, user.email!);

    // Create checkout session
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const session = await stripeService.createCheckoutSession({
      customerId: customer.id,
      priceId,
      successUrl: `${siteUrl}/dashboard/billing?success=true`,
      cancelUrl: `${siteUrl}/pricing`,
      userId: user.id,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Checkout session creation error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
