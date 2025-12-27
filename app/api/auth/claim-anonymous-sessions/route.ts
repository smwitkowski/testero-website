import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PostHog } from "posthog-node";
import { upgradeGuestSessions } from "@/lib/auth/signup-handler";
import {
  getAnonymousSessionIdFromCookie,
} from "@/lib/auth/anonymous-session-server";

const posthog = (() => {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return null;
  }

  return new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  });
})();

export async function POST(req: NextRequest) {
  const supabaseClient = createServerSupabaseClient();

  // Require authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Ensure user has verified their email
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Email verification required" },
      { status: 403 }
    );
  }

  try {
    // Get anonymous session ID from cookie or request body
    const body = await req.json().catch(() => ({}));
    const requestAnonymousSessionId = body.anonymousSessionId;
    const cookieAnonymousSessionId = await getAnonymousSessionIdFromCookie();
    const effectiveAnonymousSessionId =
      requestAnonymousSessionId || cookieAnonymousSessionId;

    if (!effectiveAnonymousSessionId) {
      // No anonymous sessions to claim - this is fine
      return NextResponse.json({
        guestUpgraded: false,
        sessionsTransferred: 0,
      });
    }

    // Create analytics wrapper
    const analytics = posthog
      ? {
          capture: (event: {
            event: string;
            properties: Record<string, unknown>;
          }) => {
            posthog.capture({
              event: event.event,
              properties: event.properties,
              distinctId: user.id,
            });
          },
        }
      : {
          capture: () => {
            return undefined;
          },
        };

    // Upgrade guest sessions
    const upgradeResult = await upgradeGuestSessions(
      supabaseClient,
      user.id,
      effectiveAnonymousSessionId,
      analytics
    );

    if (upgradeResult.error) {
      console.error("Error claiming anonymous sessions:", upgradeResult.error);
      return NextResponse.json(
        { error: "Failed to claim sessions" },
        { status: 500 }
      );
    }

    // Track successful claim
    analytics.capture({
      event: "anonymous_sessions_claimed",
      properties: {
        userId: user.id,
        sessionsTransferred: upgradeResult.transferred,
        guestUpgraded: upgradeResult.transferred > 0,
      },
    });

    return NextResponse.json({
      guestUpgraded: upgradeResult.transferred > 0,
      sessionsTransferred: upgradeResult.transferred,
    });
  } catch (error) {
    console.error("Error in claim-anonymous-sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Cleanup: flush PostHog events on process exit (for dev/local)
if (process.env.NODE_ENV !== "production") {
  process.on("exit", () => posthog?.shutdown());
}
