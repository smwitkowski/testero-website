import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Handles Supabase PKCE-style email confirmation via token hash
 * This endpoint is called when users click the confirmation link in their email
 * 
 * Expected URL format: /auth/confirm?token_hash=...&type=email|signup&next=/dashboard
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  // Determine the canonical site URL for redirects
  // Prefer NEXT_PUBLIC_SITE_URL (production) and fall back to the request origin (local/tests)
  const siteUrl =
    (process.env.NEXT_PUBLIC_SITE_URL &&
      // Ensure no trailing slash to avoid duplicated slashes when constructing URLs
      process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")) ||
    new URL(request.url).origin;

  // Validate required parameters
  if (!tokenHash || !type) {
    console.error("Auth confirm: Missing required parameters", {
      hasTokenHash: !!tokenHash,
      hasType: !!type,
    });
    const url = new URL("/login", siteUrl);
    url.searchParams.set("verification_error", "1");
    return NextResponse.redirect(url);
  }

  // Validate type is one of the expected values
  // Note: Supabase's verifyOtp only accepts: "email", "recovery", "magiclink", "invite", "email_change"
  // For signup confirmations, we normalize "signup" to "email"
  const validTypes = ["email", "signup", "recovery", "magiclink", "invite", "email_change"];
  if (!validTypes.includes(type)) {
    console.error("Auth confirm: Invalid type parameter", { type });
    const url = new URL("/login", request.url);
    url.searchParams.set("verification_error", "1");
    return NextResponse.redirect(url);
  }

  // Normalize "signup" to "email" since Supabase's verifyOtp doesn't accept "signup"
  const normalizedType = type === "signup" ? "email" : type;

  try {
    const supabase = createServerSupabaseClient();

    // Verify the OTP token hash with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: normalizedType as "email" | "recovery" | "magiclink" | "invite" | "email_change",
    });

    if (error) {
      // Log detailed error server-side for debugging
      console.error("Auth confirm: verifyOtp failed", {
        error: error.message,
        originalType: type,
        normalizedType,
        // Don't log full token_hash for security
        tokenHashPrefix: tokenHash.substring(0, 8),
      });

      // Redirect to login with error flag
      const url = new URL("/login", siteUrl);
      url.searchParams.set("verification_error", "1");
      return NextResponse.redirect(url);
    }

    // Verify we got a session back
    if (!data.session) {
      console.error("Auth confirm: verifyOtp succeeded but no session returned");
      const url = new URL("/login", siteUrl);
      url.searchParams.set("verification_error", "1");
      return NextResponse.redirect(url);
    }

    // Success: redirect to the specified next URL or dashboard
    // The session cookies are automatically set by the Supabase server client

    // Handle both relative and absolute URLs for the next parameter
    let redirectUrl: URL;
    try {
      // Try parsing as absolute URL first
      redirectUrl = new URL(next);
    } catch {
      // If parsing as absolute URL fails, treat as relative path under the canonical site URL
      redirectUrl = new URL(next, siteUrl);
    }

    // Ensure the redirect URL stays on our canonical site origin
    const allowedOrigin = new URL(siteUrl).origin;
    if (redirectUrl.origin !== allowedOrigin) {
      console.warn("Auth confirm: Invalid redirect origin, defaulting to dashboard", {
        requestedOrigin: redirectUrl.origin,
        allowedOrigin,
      });
      return NextResponse.redirect(new URL("/dashboard", siteUrl));
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    // Catch any unexpected errors
    console.error("Auth confirm: Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
      originalType: type,
      normalizedType,
    });

    const url = new URL("/login", siteUrl);
    url.searchParams.set("verification_error", "1");
    return NextResponse.redirect(url);
  }
}

