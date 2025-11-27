import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/practice/session/[sessionId]/complete
 * 
 * Mark a practice session as completed.
 * Returns redirect to summary page.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const supabase = createServerSupabaseClient();

  try {
    const { sessionId } = await params;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Invalid session ID provided" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Practice sessions require authentication
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Verify session exists and belongs to user
    const { data: dbSession, error: sessionError } = await supabase
      .from("practice_sessions")
      .select("id, user_id, completed_at")
      .eq("id", sessionId)
      .single();

    if (sessionError || !dbSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (dbSession.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized to access this session" },
        { status: 403 }
      );
    }

    if (dbSession.completed_at) {
      // Already completed, just return success
      return NextResponse.json({
        success: true,
        sessionId,
        route: `/practice/session/${sessionId}/summary`,
      });
    }

    // Mark session as completed
    const { error: updateError } = await supabase
      .from("practice_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Error completing practice session:", updateError);
      return NextResponse.json(
        { error: "Failed to complete session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      route: `/practice/session/${sessionId}/summary`,
    });
  } catch (error) {
    console.error("POST practice complete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

