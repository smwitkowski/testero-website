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

  // Validate required parameters
  if (!tokenHash || !type) {
    console.error("Auth confirm: Missing required parameters", {
      hasTokenHash: !!tokenHash,
      hasType: !!type,
    });
    const url = new URL("/login", request.url);
    url.searchParams.set("verification_error", "1");
    return NextResponse.redirect(url);
  }

  // Validate type is one of the expected values
  const validTypes = ["email", "signup", "recovery", "magiclink", "invite", "email_change"];
  if (!validTypes.includes(type)) {
    console.error("Auth confirm: Invalid type parameter", { type });
    const url = new URL("/login", request.url);
    url.searchParams.set("verification_error", "1");
    return NextResponse.redirect(url);
  }

  try {
    const supabase = createServerSupabaseClient();

    // Verify the OTP token hash with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "signup" | "recovery" | "magiclink" | "invite" | "email_change",
    });

    if (error) {
      // Log detailed error server-side for debugging
      console.error("Auth confirm: verifyOtp failed", {
        error: error.message,
        type,
        // Don't log full token_hash for security
        tokenHashPrefix: tokenHash.substring(0, 8),
      });

      // Redirect to login with error flag
      const url = new URL("/login", request.url);
      url.searchParams.set("verification_error", "1");
      return NextResponse.redirect(url);
    }

    // Verify we got a session back
    if (!data.session) {
      console.error("Auth confirm: verifyOtp succeeded but no session returned");
      const url = new URL("/login", request.url);
      url.searchParams.set("verification_error", "1");
      return NextResponse.redirect(url);
    }

    // Success: redirect to the specified next URL or dashboard
    // The session cookies are automatically set by the Supabase server client
    const redirectUrl = new URL(next, request.url);
    
    // Ensure the redirect URL is on the same origin for security
    if (redirectUrl.origin !== new URL(request.url).origin) {
      console.warn("Auth confirm: Invalid redirect origin, defaulting to dashboard", {
        requestedOrigin: redirectUrl.origin,
        requestOrigin: new URL(request.url).origin,
      });
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    // Catch any unexpected errors
    console.error("Auth confirm: Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
      type,
    });

    const url = new URL("/login", request.url);
    url.searchParams.set("verification_error", "1");
    return NextResponse.redirect(url);
  }
}

