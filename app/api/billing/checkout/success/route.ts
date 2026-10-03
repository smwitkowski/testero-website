import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signGraceCookie } from "@/lib/billing/grace-cookie";
import { StripeService } from "@/lib/stripe/stripe-service";
import { grantPmlePass, isPaidPassSession } from "@/lib/stripe/pmle-pass";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

/**
 * Handle Stripe checkout success redirect
 * Verifies Stripe session and sets a signed grace cookie for authenticated users
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const failureUrl = `${siteUrl}/dashboard/billing?success=0`;

  try {
    // Extract session_id from query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      console.error("[Checkout Success] Missing session_id parameter");
      return NextResponse.redirect(failureUrl, { status: 303 });
    }

    // Get authenticated user
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[Checkout Success] Unauthenticated request", {
        error: authError ? "Auth error" : "No user",
      });
      return NextResponse.redirect(failureUrl, { status: 303 });
    }

    // Retrieve and verify the Stripe checkout session
    const stripeService = new StripeService();
    let session;

    try {
      session = await stripeService.retrieveCheckoutSession(sessionId);
    } catch (stripeError) {
      console.error("[Checkout Success] Failed to retrieve Stripe session", {
        error: stripeError instanceof Error ? stripeError.message : "Unknown error",
      });
      return NextResponse.redirect(failureUrl, { status: 303 });
    }

    // Verify payment status
    if (!isPaidPassSession(session)) {
      console.error("[Checkout Success] Session payment not completed", {
        session_id: sessionId,
        payment_status: session.payment_status,
      });
      return NextResponse.redirect(failureUrl, { status: 303 });
    }

    // Verify the session belongs to the authenticated user
    const sessionUserId = session.metadata?.user_id;
    if (!sessionUserId || sessionUserId !== user.id) {
      console.error("[Checkout Success] User ID mismatch", {
        authenticated_user: user.id,
        session_metadata_user: sessionUserId || "missing",
      });
      return NextResponse.redirect(failureUrl, { status: 303 });
    }

    // Fulfill synchronously as well as by webhook: no paid-before-webhook gap.
    // Service-role writes only follow authenticated ownership + Stripe verification.
    const { pass, refunded } = await grantPmlePass(
      stripeService,
      createServiceSupabaseClient(),
      session
    );
    if (refunded || Date.parse(pass.expires_at) <= Date.now()) {
      return NextResponse.redirect(failureUrl, { status: 303 });
    }

    // All checks passed - issue a user/session-bound, 15-minute grace cookie.
    const { name, value, options } = signGraceCookie({
      userId: user.id,
      checkoutSessionId: session.id,
    });
    const cookieStore = await cookies();
    cookieStore.set(name, value, options);

    console.log("[Checkout Success] Grace cookie issued", {
      user_id: user.id,
      session_id: sessionId,
    });

    return NextResponse.redirect(`${siteUrl}/dashboard/billing?success=1`, { status: 303 });
  } catch (error) {
    console.error("[Checkout Success] Unexpected error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.redirect(failureUrl, { status: 303 });
  }
}
