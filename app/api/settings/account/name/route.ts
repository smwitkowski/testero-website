import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { z } from "zod";
import { getServerPostHog } from "@/lib/analytics/server-analytics";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/analytics";

const updateNameSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parse = updateNameSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { fullName } = parse.data;

    // Update user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim(),
      },
    });

    if (updateError) {
      console.error("Error updating user name:", updateError);
      return NextResponse.json({ error: "Failed to update name" }, { status: 500 });
    }

    // Track analytics
    const posthog = getServerPostHog();
    trackEvent(
      posthog,
      ANALYTICS_EVENTS.SETTINGS_ACCOUNT_NAME_UPDATED,
      {
        user_id: user.id,
      },
      user.id
    );

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Error updating user name:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
