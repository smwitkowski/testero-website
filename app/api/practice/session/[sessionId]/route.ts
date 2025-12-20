import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/practice/session/[sessionId]
 * 
 * Returns practice session data with questions for authenticated session owner.
 * Mirrors the diagnostic GET endpoint pattern.
 */
export async function GET(
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

    // Fetch session from DB
    const { data: dbSession, error: sessionError } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !dbSession) {
      console.error("Error fetching practice session or session not found:", sessionError);
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // Authorization check - ensure user owns the session
    if (dbSession.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized to access this session." },
        { status: 403 }
      );
    }

    // Check if session is already completed
    if (dbSession.completed_at) {
      return NextResponse.json(
        { error: "Session already completed." },
        { status: 400 }
      );
    }

    // Fetch snapshotted questions for this session
    const { data: sessionQuestions, error: questionsError } = await supabase
      .from("practice_questions")
      .select("id, stem, options, correct_label")
      .eq("session_id", sessionId)
      .order("id", { ascending: true }); // Maintain question order

    if (questionsError) {
      console.error("Error fetching session questions:", questionsError);
      return NextResponse.json(
        { error: "Failed to load questions for the session." },
        { status: 500 }
      );
    }

    if (!sessionQuestions || sessionQuestions.length === 0) {
      return NextResponse.json(
        { error: "No questions found for this session." },
        { status: 404 }
      );
    }

    // Reconstruct session object for client
    const clientSessionData = {
      id: dbSession.id,
      userId: dbSession.user_id,
      exam: dbSession.exam,
      questions: sessionQuestions.map((q) => ({
        id: q.id, // UUID of the snapshotted question
        stem: q.stem,
        options: q.options, // JSONB options {label, text}
      })),
      startedAt: dbSession.created_at,
      questionCount: dbSession.question_count,
      source: dbSession.source,
      sourceSessionId: dbSession.source_session_id,
    };

    return NextResponse.json({ session: clientSessionData });
  } catch (error) {
    console.error("GET practice session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

