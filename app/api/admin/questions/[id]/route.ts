import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdmin } from "@/lib/auth/isAdmin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  fetchQuestionForEditor,
  fetchDomainOptions,
} from "@/lib/admin/questions/editor-query";
import { QuestionUpdateSchema } from "@/lib/admin/questions/editor-schema";

const UuidSchema = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const uuidValidation = UuidSchema.safeParse(resolvedParams.id);
    if (!uuidValidation.success) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const question = await fetchQuestionForEditor(supabase, resolvedParams.id);

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const domains = await fetchDomainOptions(supabase);

    return NextResponse.json({
      question,
      domains,
    });
  } catch (error) {
    console.error("[AdminQuestionDetail] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const uuidValidation = UuidSchema.safeParse(resolvedParams.id);
    if (!uuidValidation.success) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const json = await request.json().catch(() => ({}));
    const parsed = QuestionUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const serviceSupabase = createServiceSupabaseClient();

    // Update question
    const { error: questionError } = await serviceSupabase
      .from("questions")
      .update({
        domain_id: payload.domain_id,
        difficulty: payload.difficulty,
        status: payload.status,
        review_status: payload.review_status,
        review_notes: payload.review_notes,
        stem: payload.stem,
      })
      .eq("id", resolvedParams.id);

    if (questionError) {
      console.error("[AdminQuestionDetail] Failed to update question:", questionError);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    // Upsert answers (delete existing and insert new)
    const { error: deleteAnswersError } = await serviceSupabase
      .from("answers")
      .delete()
      .eq("question_id", resolvedParams.id);

    if (deleteAnswersError) {
      console.error("[AdminQuestionDetail] Failed to delete answers:", deleteAnswersError);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    if (payload.answers.length > 0) {
      const answersToInsert = payload.answers.map((answer) => ({
        question_id: resolvedParams.id,
        choice_label: answer.choice_label,
        choice_text: answer.choice_text,
        is_correct: answer.is_correct,
        explanation_text: answer.explanation_text || null,
      }));

      const { error: insertAnswersError } = await serviceSupabase
        .from("answers")
        .insert(answersToInsert);

      if (insertAnswersError) {
        console.error("[AdminQuestionDetail] Failed to insert answers:", insertAnswersError);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }
    }

    // Fetch updated question
    const updatedQuestion = await fetchQuestionForEditor(supabase, resolvedParams.id);

    return NextResponse.json({
      question: updatedQuestion,
    });
  } catch (error) {
    console.error("[AdminQuestionDetail] PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
