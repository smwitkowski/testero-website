import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Returns the current authenticated user's session information
 * Used by /verify-email to check if user is already authenticated via PKCE flow
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Return minimal user info needed for verification success flow
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
      },
    });
  } catch (error) {
    // Fail gracefully - return null user on any error
    console.error("Session endpoint error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
