import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSubscriber } from "@/lib/auth/entitlements";
import { getServerPostHog } from "@/lib/analytics/server-analytics";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { verifyGraceCookie, hasGraceCookie, clearGraceCookie } from "@/lib/billing/grace-cookie";
import { isBillingEnforcementActive } from "@/lib/billing/enforcement";

/**
 * Create structured log entry for paywall block
 */
function createPaywallLog(route: string, userId: string | null, reason: string): string {
  return JSON.stringify({
    event: "paywall_block",
    route,
    userId,
    reason,
    ts: new Date().toISOString(),
  });
}

/**
 * Require subscriber access for premium API routes.
 * 
 * Checks in order:
 * 1. Billing enforcement flag - if disabled, allows all access
 * 2. Valid grace cookie (checkout_grace) - allows access without auth
 * 3. Authenticated user with active/trialing subscription
 * 
 * Returns null if access is granted, or NextResponse with 403 if blocked.
 * Grace cookies are cleared on first successful entitlement pass or when expired/invalid.
 * 
 * @param req - Request or NextRequest object
 * @param route - Route path for logging (e.g., "/api/questions/current")
 * @returns Promise<NextResponse | null> - null if allowed, NextResponse with 403 if blocked
 */
export async function requireSubscriber(
  req: Request | NextRequest,
  route: string
): Promise<NextResponse | null> {
  // When billing enforcement is disabled, never block (no paywall in this environment)
  if (!isBillingEnforcementActive()) {
    return null;
  }

  // Check grace cookie first
  const hasGrace = hasGraceCookie(req);
  const isValidGrace = verifyGraceCookie(req);
  
  if (hasGrace && isValidGrace) {
    // Valid grace cookie - allow access
    // Cookie will be cleared by caller when they detect successful subscription check
    return null;
  }
  
  // If grace cookie exists but is invalid/expired, clear it and continue checking
  // We don't block immediately - let auth/subscription checks proceed
  if (hasGrace && !isValidGrace) {
    // Cookie is present but invalid/expired - log but continue to auth checks
    const logEntry = createPaywallLog(route, null, "grace_cookie_expired_or_invalid");
    console.log(logEntry);
  }

  // Check authentication
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    // Unauthenticated - block
    const logEntry = createPaywallLog(route, null, "unauthenticated");
    console.log(logEntry);

    const posthog = getServerPostHog();
    if (posthog) {
      trackEvent(
        posthog,
        ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
        {
          route,
          reason: "unauthenticated",
          userId: null,
        },
        undefined
      );
    }

    return NextResponse.json({ code: "PAYWALL" }, { status: 403 });
  }

  // Check subscription status
  const hasSubscription = await isSubscriber(user.id);

  if (!hasSubscription) {
    // Not a subscriber - block
    // If grace cookie exists but is invalid, clear it in the error response
    const response = NextResponse.json({ code: "PAYWALL" }, { status: 403 });
    
    if (hasGrace && !isValidGrace) {
      // Clear invalid/expired grace cookie
      const { name, value, options } = clearGraceCookie();
      response.cookies.set(name, value, options);
    }
    
    const logEntry = createPaywallLog(route, user.id, "not_subscriber");
    console.log(logEntry);

    const posthog = getServerPostHog();
    if (posthog) {
      trackEvent(
        posthog,
        ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
        {
          route,
          reason: "not_subscriber",
          userId: user.id,
        },
        user.id
      );
    }

    return response;
  }

  // User is authenticated and has subscription - allow
  // Note: Grace cookie clearing on successful entitlement pass should be handled
  // by the caller in their response, or by middleware/access.ts
  return null;
}

