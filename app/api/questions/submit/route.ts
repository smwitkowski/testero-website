import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireSubscriber } from "@/lib/auth/require-subscriber";
import { answerLabel, resolveAnswerOrder } from "@/lib/questions/answer-order";

export async function POST(req: Request) {
  try {
    // Premium gate check
    const block = await requireSubscriber(req, "/api/questions/submit");
    if (block) return block;

    const body = (await req.json()) as {
      questionId: string;
      selectedOptionKey: string;
      selectedOptionId?: string;
      optionOrder?: unknown;
    };
    const { questionId, selectedOptionKey, selectedOptionId, optionOrder } = body;

    if (!questionId || !selectedOptionKey) {
      return NextResponse.json(
        { error: "Missing questionId or selectedOptionKey." },
        { status: 400 }
      );
    }

    // Note: Canonical schema uses UUIDs for question_id, but practice_attempts still uses bigint
    // For now, we'll accept UUIDs but practice_attempts insert may fail if question_id doesn't exist in legacy table

    // Create server-side Supabase client after the durable paid-access gate
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    // requireSubscriber requires authenticated, durable paid access.

    // Fetch answers for the question with per-option explanations (canonical schema uses 'answers' table)
    const { data: answers, error: answersError } = await supabase
      .from("answers")
      .select("id, choice_label, is_correct, explanation_text")
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

    // New clients submit a stable answer ID and the displayed order. Old clients
    // still submit canonical labels. Never compare a shuffled display label to a
    // canonical label, or use client-supplied correctness.
    const hasDisplayOrder = selectedOptionId !== undefined || optionOrder !== undefined;
    const orderedAnswers = hasDisplayOrder ? resolveAnswerOrder(answers, optionOrder) : answers;
    const selectedAnswer = hasDisplayOrder
      ? orderedAnswers?.find((answer, index) =>
          String(answer.id) === selectedOptionId && answerLabel(index) === selectedOptionKey)
      : answers.find((answer) => answer.choice_label === selectedOptionKey);

    if (!orderedAnswers || !selectedAnswer) {
      return NextResponse.json({ error: "Invalid selected answer or option order." }, { status: 400 });
    }

    const isCorrect = String(selectedAnswer.id) === String(correctAnswer.id);
    const correctOptionKey = hasDisplayOrder
      ? answerLabel(orderedAnswers.findIndex((answer) => String(answer.id) === String(correctAnswer.id)))
      : correctAnswer.choice_label;

    const explanationsByOptionKey: Record<string, string | null> = {};
    orderedAnswers.forEach((answer, index) => {
      const label = hasDisplayOrder ? answerLabel(index) : answer.choice_label;
      explanationsByOptionKey[label] = answer.explanation_text || null;
    });

    // Fetch question metadata for practice_attempts snapshot
    // Note: topic column doesn't exist in canonical schema, so we skip it
    const { data: questionMeta } = await supabase
      .from("questions")
      .select("difficulty")
      .eq("id", questionId)
      .single();

    // Record attempt in practice_question_attempts_v2 (canonical UUID-based table)
    // This is the primary tracking table for "no-repeat-until-exhausted" question rotation
    if (user) {
      const { error: v2InsertError } = await supabase
        .from("practice_question_attempts_v2")
        .upsert(
          {
            user_id: user.id,
            question_id: questionId,
            selected_label: selectedAnswer.choice_label,
            is_correct: isCorrect,
          },
          {
            onConflict: "user_id,question_id",
            ignoreDuplicates: false, // Update existing record with new answer if user retries
          }
        );

      if (v2InsertError) {
        console.error("practice_question_attempts_v2 upsert failed:", {
          error: v2InsertError,
          context: { questionId, userId: user.id },
        });
      }
    }

    // Legacy practice_attempts insert (kept for backward compatibility with existing analytics)
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
          selected_label: selectedAnswer.choice_label,
          is_correct: isCorrect,
          topic: null, // topic column doesn't exist in canonical schema
          difficulty: difficultyNum,
        });

      if (insertError) {
        // Log but don't fail - legacy table insert is best-effort
        console.error("practice_attempts insert failed (legacy, non-blocking):", {
          error: insertError,
          data: insertData,
          context: { questionId: questionIdNum, userId: user.id },
        });
      }
    }

    return NextResponse.json({
      isCorrect,
      correctOptionKey,
      explanationsByOptionKey,
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
