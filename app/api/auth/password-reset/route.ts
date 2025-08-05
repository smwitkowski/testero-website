import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PostHog } from "posthog-node";
import { z } from "zod";
import { createSuccessResponse, createErrorResponse, commonErrors } from "@/lib/api/response-utils";
import { checkRateLimit } from "@/lib/auth/rate-limiter";

const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || "", {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
});

const passwordResetSchema = z.object({
  email: z.string().email(),
});

interface PasswordResetRequestBody {
  email: string;
}

export async function POST(req: NextRequest) {
  let body: PasswordResetRequestBody;
  try {
    body = await req.json();
  } catch {
    return commonErrors.invalidJson();
  }

  // Validate input
  const parse = passwordResetSchema.safeParse(body);
  if (!parse.success) {
    return createErrorResponse("Invalid email address");
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const { email } = parse.data;

  // Rate limiting with Redis
  if (!(await checkRateLimit(ip))) {
    posthog.capture({
      event: "password_reset_rate_limited",
      properties: { ip, email },
      distinctId: email,
    });
    return commonErrors.tooManyRequests("Too many password reset attempts");
  }

  const supabaseClient = createServerSupabaseClient();

  try {
    // Track attempt
    posthog.capture({
      event: "password_reset_requested",
      properties: { email },
      distinctId: email,
    });

    // Request password reset with redirect to our reset password page
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password`,
    });

    if (error) {
      throw error;
    }

    // Track success
    posthog.capture({
      event: "password_reset_email_sent",
      properties: { email },
      distinctId: email,
    });

    return createSuccessResponse();
  } catch (error) {
    const detailedError = error instanceof Error ? error.message : "Password reset failed";

    // Log detailed error server-side for debugging
    console.error("Password reset error:", { email, error: detailedError });

    // Track error with detailed information for analytics
    posthog.capture({
      event: "password_reset_error",
      properties: { email, error: detailedError },
      distinctId: email,
    });

    // Return generic error message to prevent information leakage
    return createErrorResponse("Request failed. Please try again.");
  }
}

// Cleanup: flush PostHog events on process exit (for dev/local)
if (process.env.NODE_ENV !== "production") {
  process.on("exit", () => posthog.shutdown());
}
