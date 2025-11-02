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

    // Validate questionId is numeric
    const questionIdNum = Number(questionId);
    if (!Number.isFinite(questionIdNum) || !Number.isInteger(questionIdNum)) {
      return NextResponse.json(
        { error: "Invalid questionId format." },
        { status: 400 }
      );
    }

    // Create server-side Supabase client - user may be null if access via grace cookie
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    // Note: requireSubscriber ensures user is authenticated OR has valid grace cookie
    // If user is null (grace cookie), we skip practice_attempts tracking

    // Fetch options for the question
    const { data: options, error: optionsError } = await supabase
      .from("options")
      .select("id, label, is_correct")
      .eq("question_id", questionId);

    if (optionsError || !options || options.length === 0) {
      return NextResponse.json({ error: "No options found for this question." }, { status: 404 });
    }

    // Find the correct option
    const correctOption = options.find((opt) => opt.is_correct);
    if (!correctOption) {
      return NextResponse.json(
        { error: "No correct option found for this question." },
        { status: 500 }
      );
    }

    // Compare selectedOptionKey with correct option's label
    const isCorrect = selectedOptionKey === correctOption.label;

    // Fetch explanation (if available)
    const { data: explanationRow } = await supabase
      .from("explanations")
      .select("text")
      .eq("question_id", questionId)
      .single();
    const explanationText = explanationRow?.text || "";

    // Fetch question metadata for practice_attempts snapshot
    const { data: questionMeta } = await supabase
      .from("questions")
      .select("topic, difficulty")
      .eq("id", questionId)
      .single();

    // Best-effort insert to practice_attempts (only if user is authenticated)
    if (user) {
      const { data: insertData, error: insertError } = await supabase
        .from("practice_attempts")
        .insert({
          user_id: user.id,
          question_id: questionIdNum,
          selected_label: selectedOptionKey,
          is_correct: isCorrect,
          topic: questionMeta?.topic ?? null,
          difficulty: questionMeta?.difficulty ?? null,
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
      correctOptionKey: correctOption.label,
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
