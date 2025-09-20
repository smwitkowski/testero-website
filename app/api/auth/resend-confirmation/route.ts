import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PostHog } from "posthog-node";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth/rate-limiter";

const posthog = (() => {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return null;
  }

  return new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  });
})();

const resendConfirmationSchema = z.object({
  email: z.string().email(),
});

interface ResendConfirmationRequestBody {
  email: string;
}

export async function POST(req: NextRequest) {
  let body: ResendConfirmationRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate input
  const parse = resendConfirmationSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const { email } = parse.data;

  // Rate limiting with Redis
  if (!(await checkRateLimit(ip))) {
    posthog?.capture({
      event: "resend_confirmation_rate_limited",
      properties: { ip, email },
      distinctId: email,
    });
    return NextResponse.json({ error: "Too many resend confirmation attempts" }, { status: 429 });
  }

  const supabaseClient = createServerSupabaseClient();

  try {
    // Track attempt
    posthog?.capture({
      event: "resend_confirmation_requested",
      properties: { email },
      distinctId: email,
    });

    // Resend confirmation email with redirect to our verify email page
    const { error } = await supabaseClient.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/verify-email`,
      },
    });

    if (error) {
      throw error;
    }

    // Track success
    posthog?.capture({
      event: "resend_confirmation_email_sent",
      properties: { email },
      distinctId: email,
    });

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    const detailedError = error instanceof Error ? error.message : "Resend confirmation failed";

    // Log detailed error server-side for debugging
    console.error("Resend confirmation error:", { email, error: detailedError });

    // Track error with detailed information for analytics
    posthog?.capture({
      event: "resend_confirmation_error",
      properties: { email, error: detailedError },
      distinctId: email,
    });

    // Return generic error message to prevent information leakage
    return NextResponse.json({ error: "Request failed. Please try again." }, { status: 500 });
  }
}

// Cleanup: flush PostHog events on process exit (for dev/local)
if (process.env.NODE_ENV !== "production") {
  process.on("exit", () => posthog?.shutdown());
}
