import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireSubscriber } from "@/lib/auth/require-subscriber";

export async function POST(req: Request) {
  try {
    // Premium gate check
    const block = await requireSubscriber(req, "/api/questions/submit");
    if (block) return block;

    const body = (await req.json()) as { questionId: string; selectedOptionKey: string };
    const { questionId, selectedOptionKey } = body;

    if (!questionId || !selectedOptionKey) {
      return NextResponse.json(
        { error: "Missing questionId or selectedOptionKey." },
        { status: 400 }
      );
    }

    // Note: Canonical schema uses UUIDs for question_id, but practice_attempts still uses bigint
    // For now, we'll accept UUIDs but practice_attempts insert may fail if question_id doesn't exist in legacy table

    // Create server-side Supabase client - user may be null if access via grace cookie
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    // Note: requireSubscriber ensures user is authenticated OR has valid grace cookie
    // If user is null (grace cookie), we skip practice_attempts tracking

    // Fetch answers for the question (canonical schema uses 'answers' table)
    const { data: answers, error: answersError } = await supabase
      .from("answers")
      .select("id, choice_label, is_correct")
      .eq("question_id", questionId);

    if (answersError || !answers || answers.length === 0) {
      return NextResponse.json({ error: "No answers found for this question." }, { status: 404 });
    }

    // Find the correct answer
    const correctAnswer = answers.find((ans) => ans.is_correct);
    if (!correctAnswer) {
      return NextResponse.json(
        { error: "No correct answer found for this question." },
        { status: 500 }
      );
    }

    // Compare selectedOptionKey with correct answer's choice_label
    const isCorrect = selectedOptionKey === correctAnswer.choice_label;

    // Fetch explanation (if available) - canonical schema uses explanation_text column
    const { data: explanationRow } = await supabase
      .from("explanations")
      .select("explanation_text")
      .eq("question_id", questionId)
      .single();
    const explanationText = explanationRow?.explanation_text || "";

    // Fetch question metadata for practice_attempts snapshot
    // Note: topic column doesn't exist in canonical schema, so we skip it
    const { data: questionMeta } = await supabase
      .from("questions")
      .select("difficulty")
      .eq("id", questionId)
      .single();

    // Best-effort insert to practice_attempts (only if user is authenticated)
    // Note: practice_attempts.question_id is bigint (legacy), but canonical questions use UUID
    // This insert may fail if question_id doesn't exist in legacy questions_legacy table
    if (user) {
      // Try to convert UUID to numeric if possible, otherwise skip practice_attempts insert
      const questionIdNum = Number.parseInt(questionId.replace(/-/g, '').substring(0, 15), 16);
      
      // Convert text difficulty (EASY, MEDIUM, HARD) to numeric for legacy practice_attempts table
      // practice_attempts.difficulty is smallint, but canonical questions.difficulty is TEXT
      let difficultyNum: number | null = null;
      if (questionMeta?.difficulty) {
        const difficultyMap: Record<string, number> = {
          'EASY': 1,
          'MEDIUM': 3,
          'HARD': 5,
        };
        difficultyNum = difficultyMap[questionMeta.difficulty.toUpperCase()] ?? null;
      }
      
      const { data: insertData, error: insertError } = await supabase
        .from("practice_attempts")
        .insert({
          user_id: user.id,
          question_id: questionIdNum,
          selected_label: selectedOptionKey,
          is_correct: isCorrect,
          topic: null, // topic column doesn't exist in canonical schema
          difficulty: difficultyNum,
        });

      if (insertError) {
        console.error("practice_attempts insert failed:", {
          error: insertError,
          data: insertData,
          context: { questionId: questionIdNum, userId: user.id },
        });
      }
    }

    return NextResponse.json({
      isCorrect,
      correctOptionKey: correctAnswer.choice_label,
      explanationText,
    });
  } catch (error) {
    console.error("Question submit API error:", error);
    return NextResponse.json(
      {
        error: "Invalid request or server error.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
