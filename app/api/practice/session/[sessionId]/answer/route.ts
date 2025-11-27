import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/practice/session/[sessionId]/answer
 * 
 * Submit an answer for a practice session question.
 * Calculates correctness and stores in practice_responses table.
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

    // Parse request body
    const body = await req.json();
    const { questionId, selectedLabel } = body;

    // Validate input
    if (!questionId || typeof questionId !== "string") {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const normalizedSelectedLabel =
      typeof selectedLabel === "string" ? selectedLabel.trim().toUpperCase() : null;

    if (!normalizedSelectedLabel || !["A", "B", "C", "D", "E", "F"].includes(normalizedSelectedLabel)) {
      return NextResponse.json({ error: "Invalid selected label" }, { status: 400 });
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
      return NextResponse.json(
        { error: "Session already completed" },
        { status: 400 }
      );
    }

    // Fetch the question to get correct answer
    const { data: question, error: questionError } = await supabase
      .from("practice_questions")
      .select("id, correct_label, session_id")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Verify question belongs to this session
    if (question.session_id !== sessionId) {
      return NextResponse.json(
        { error: "Question does not belong to this session" },
        { status: 400 }
      );
    }

    // Check if response already exists (idempotency)
    const { data: existingResponse } = await supabase
      .from("practice_responses")
      .select("id, selected_label, is_correct")
      .eq("session_id", sessionId)
      .eq("question_id", questionId)
      .single();

    // Calculate correctness
    const isCorrect = question.correct_label.toUpperCase() === normalizedSelectedLabel;

    if (existingResponse) {
      // Update existing response
      const { error: updateError } = await supabase
        .from("practice_responses")
        .update({
          selected_label: normalizedSelectedLabel,
          is_correct: isCorrect,
          responded_at: new Date().toISOString(),
        })
        .eq("id", existingResponse.id);

      if (updateError) {
        console.error("Error updating practice response:", updateError);
        return NextResponse.json(
          { error: "Failed to update response" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        isCorrect,
        correctLabel: question.correct_label,
        updated: true,
      });
    } else {
      // Insert new response
      const { error: insertError } = await supabase
        .from("practice_responses")
        .insert({
          session_id: sessionId,
          question_id: questionId,
          selected_label: normalizedSelectedLabel,
          is_correct: isCorrect,
        });

      if (insertError) {
        console.error("Error inserting practice response:", insertError);
        return NextResponse.json(
          { error: "Failed to save response" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        isCorrect,
        correctLabel: question.correct_label,
      });
    }
  } catch (error) {
    console.error("POST practice answer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

