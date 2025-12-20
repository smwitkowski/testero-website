import { NextResponse } from "next/server";
import { getCurrentSession, SessionResponse } from "@/lib/auth/session-handler";

/**
 * Returns the current authenticated user's session information
 * Used by /verify-email to check if user is already authenticated via PKCE flow
 */
export async function GET() {
  const sessionData = await getCurrentSession();
  return NextResponse.json<SessionResponse>(sessionData, { status: 200 });
}
