import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSubscriber } from "@/lib/auth/entitlements";
import { getServerPostHog } from "@/lib/analytics/server-analytics";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import crypto from "crypto";

const GRACE_COOKIE_NAME = "tgrace";

interface GraceCookiePayload {
  userId: string;
  exp: number;
}

/**
 * Extract cookie value from Request or NextRequest
 */
function getCookieValue(req: Request | NextRequest, name: string): string | null {
  // Try cookies API first (NextRequest)
  if (req instanceof NextRequest) {
    const cookie = req.cookies.get(name);
    if (cookie) {
      return cookie.value;
    }
  }
  
  // Fallback to parsing Cookie header (works for both Request and NextRequest)
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");
    if (key === name) {
      const value = valueParts.join("="); // Handle values that contain =
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Validate and parse grace cookie
 */
function validateGraceCookie(cookieValue: string): GraceCookiePayload | null {
  const secret = process.env.GRACE_COOKIE_SECRET;
  if (!secret) {
    console.warn("[requireSubscriber] GRACE_COOKIE_SECRET not set, grace cookie validation disabled");
    return null;
  }

  try {
    const [payloadBase64, signature] = cookieValue.split(".");
    if (!payloadBase64 || !signature) {
      return null;
    }

    // Verify signature (using timing-safe comparison)
    const payload = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = Buffer.from(hmac.digest("hex"));
    const actualSignature = Buffer.from(signature, "utf-8");

    // Use timing-safe comparison to prevent timing attacks
    if (
      expectedSignature.length !== actualSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return null; // Invalid signature
    }

    // Parse and validate expiration
    const data: GraceCookiePayload = JSON.parse(payload);
    const now = Math.floor(Date.now() / 1000);

    if (data.exp < now) {
      return null; // Expired
    }

    return data;
  } catch (error) {
    console.error("[requireSubscriber] Error validating grace cookie:", error);
    return null;
  }
}

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
 * 1. Valid grace cookie (tgrace) - allows access without auth
 * 2. Authenticated user with active/trialing subscription
 * 
 * Returns null if access is granted, or NextResponse with 403 if blocked.
 * 
 * @param req - Request or NextRequest object
 * @param route - Route path for logging (e.g., "/api/questions/current")
 * @returns Promise<NextResponse | null> - null if allowed, NextResponse with 403 if blocked
 */
export async function requireSubscriber(
  req: Request | NextRequest,
  route: string
): Promise<NextResponse | null> {
  // Check grace cookie first
  const graceCookieValue = getCookieValue(req, GRACE_COOKIE_NAME);
  if (graceCookieValue) {
    const graceData = validateGraceCookie(graceCookieValue);
    if (graceData) {
      // Valid grace cookie - allow access
      return null;
    } else {
      // Invalid or expired grace cookie - block immediately
      // Try to determine reason by parsing the payload
      let reason = "grace_cookie_invalid";
      let userId: string | null = null;
      
      if (graceCookieValue.includes(".")) {
        // Has dot, try to parse payload to determine reason
        try {
          const [payloadBase64, signature] = graceCookieValue.split(".");
          const payload = Buffer.from(payloadBase64, "base64").toString("utf-8");
          const data: GraceCookiePayload = JSON.parse(payload);
          const now = Math.floor(Date.now() / 1000);
          
          // Check if signature is valid (to distinguish expired vs invalid signature)
          const secret = process.env.GRACE_COOKIE_SECRET;
          if (secret) {
            const hmac = crypto.createHmac("sha256", secret);
            hmac.update(payload);
            const expectedSignature = hmac.digest("hex");
            
            if (signature === expectedSignature) {
              // Signature is valid, so if expired, it's expired; otherwise it's invalid for another reason
              if (data.exp < now) {
                reason = "grace_cookie_expired";
                userId = data.userId || "unknown";
              } else {
                // Valid signature and not expired - shouldn't happen, but treat as invalid
                reason = "grace_cookie_invalid";
              }
            } else {
              // Invalid signature
              reason = "grace_cookie_invalid";
            }
          } else {
            // No secret configured - treat as invalid
            reason = "grace_cookie_invalid";
          }
        } catch {
          // Can't parse, invalid format
          reason = "grace_cookie_invalid";
        }
      }
      
      const logEntry = createPaywallLog(route, userId, reason);
      console.log(logEntry);

      // Track analytics
      const posthog = getServerPostHog();
      if (posthog) {
        trackEvent(
          posthog,
          ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
          {
            route,
            reason,
          },
          userId || undefined
        );
      }

      return NextResponse.json({ code: "PAYWALL" }, { status: 403 });
    }
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

    return NextResponse.json({ code: "PAYWALL" }, { status: 403 });
  }

  // User is authenticated and has subscription - allow
  return null;
}

