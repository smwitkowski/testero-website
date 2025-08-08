import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { questionId: string; selectedOptionKey: string };
    const { questionId, selectedOptionKey } = body;

    if (!questionId || !selectedOptionKey) {
      return NextResponse.json(
        { error: "Missing questionId or selectedOptionKey." },
        { status: 400 }
      );
    }

    // Create server-side Supabase client and check authentication
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("Auth check failed in question submit API:", authError?.message);
      return NextResponse.json(
        {
          error: "Authentication required. Please log in to submit answers.",
          authError: authError?.message,
        },
        { status: 401 }
      );
    }

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
