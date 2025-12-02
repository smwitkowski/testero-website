import type { SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_EXAM_ID } from "./query";
import type { QuestionEditorData, DomainOption } from "./editor-types";

interface QuestionRow {
  id: string;
  exam: string;
  domain_id: string;
  stem: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  status: "ACTIVE" | "DRAFT" | "RETIRED" | null;
  review_status: string;
  review_notes: string | null;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
  exam_domains: {
    id: string;
    code: string;
    name: string;
  } | null;
  answers: Array<{
    id: string;
    choice_label: string;
    choice_text: string;
    is_correct: boolean;
    explanation_text: string | null;
  }> | null;
}

export async function fetchQuestionForEditor(
  supabase: SupabaseClient,
  questionId: string
): Promise<QuestionEditorData | null> {
  const { data, error } = await supabase
    .from("questions")
    .select(
      `
      id,
      exam,
      domain_id,
      stem,
      difficulty,
      status,
      review_status,
      review_notes,
      source_ref,
      created_at,
      updated_at,
      exam_domains!inner(id, code, name),
      answers(id, choice_label, choice_text, is_correct, explanation_text)
    `
    )
    .eq("id", questionId)
    .eq("exam", CANONICAL_EXAM_ID)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch question: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as QuestionRow;

  // Sort answers by choice_label (A, B, C, D)
  const sortedAnswers = (row.answers || [])
    .map((answer) => ({
      id: answer.id,
      choice_label: answer.choice_label as "A" | "B" | "C" | "D",
      choice_text: answer.choice_text,
      is_correct: answer.is_correct,
      explanation_text: answer.explanation_text || undefined,
    }))
    .sort((a, b) => a.choice_label.localeCompare(b.choice_label));

  // Ensure we have exactly 4 answers (A-D)
  const answerMap = new Map(sortedAnswers.map((a) => [a.choice_label, a]));
  const allAnswers: Array<{
    id?: string;
    choice_label: "A" | "B" | "C" | "D";
    choice_text: string;
    is_correct: boolean;
    explanation_text?: string;
  }> = ["A", "B", "C", "D"].map((label) => {
    const existing = answerMap.get(label as "A" | "B" | "C" | "D");
    return (
      existing || {
        choice_label: label as "A" | "B" | "C" | "D",
        choice_text: "",
        is_correct: false,
        explanation_text: undefined,
      }
    );
  });

  return {
    id: row.id,
    exam: row.exam,
    domain_id: row.domain_id,
    domain_code: row.exam_domains?.code ?? "",
    domain_name: row.exam_domains?.name ?? "",
    stem: row.stem,
    difficulty: row.difficulty,
    status: row.status,
    review_status: row.review_status as QuestionEditorData["review_status"],
    review_notes: row.review_notes,
    source_ref: row.source_ref,
    answers: allAnswers,
    explanation: null, // No longer using question-level explanations
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchDomainOptions(
  supabase: SupabaseClient
): Promise<DomainOption[]> {
  const { data, error } = await supabase
    .from("exam_domains")
    .select("id, code, name")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch domain options: ${error.message}`);
  }

  return (data || []).map((domain) => ({
    id: domain.id,
    code: domain.code,
    name: domain.name,
  }));
}
