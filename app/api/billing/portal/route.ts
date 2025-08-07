import { NextRequest, NextResponse } from "next/server";
import { StripeService } from "@/lib/stripe/stripe-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";

interface PortalSessionResponse {
  url: string;
}

interface ErrorResponse {
  error: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<PortalSessionResponse | ErrorResponse>> {
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
      return NextResponse.json({ error: "You must be authenticated" }, { status: 401 });
    }

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (subError || !subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    // Create portal session
    const stripeService = new StripeService();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const session = await stripeService.createPortalSession(
      subscription.stripe_customer_id,
      `${siteUrl}/dashboard/billing`
    );

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Portal session creation error:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
