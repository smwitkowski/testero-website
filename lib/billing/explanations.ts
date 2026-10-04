import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaidQuestionReview, QuestionReview } from "@/lib/diagnostic/types";

export interface ExplanationItem {
  id: string;
  question_id?: string;
  options: { label: string; text: string }[];
}
export interface PaidExplanation {
  explanation?: string;
  optionExplanations?: { label: string; text: string; explanation: string }[];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nonblank = (text: unknown): text is string => typeof text === "string" && text.trim().length > 0;

/** Only call after fresh paid access and completed/answered ownership checks.
 * Shuffled labels are not canonical labels. Match exact immutable text instead.
 * A changed, missing or ambiguous bank entry redacts that entire item's content.
 */
export async function loadPaidExplanations(client: SupabaseClient, items: ExplanationItem[]): Promise<Map<string, PaidExplanation>> {
  const result = new Map<string, PaidExplanation>();
  const eligible = items.filter(item => typeof item.question_id === "string" && UUID.test(item.question_id));
  const ids = [...new Set(eligible.map(item => item.question_id!))];
  if (!ids.length) return result;
  try {
    const { data: answers, error: answerError } = await client.from("answers")
      .select("question_id,choice_text,explanation_text").in("question_id", ids);
    const { data: explanations, error: explanationError } = await client.from("explanations")
      .select("question_id,explanation_text").in("question_id", ids);
    if (answerError || explanationError || !Array.isArray(answers) || !Array.isArray(explanations)) return result;
    for (const item of eligible) {
      const canonical = answers.filter(answer => answer.question_id === item.question_id);
      const questionExplanations = explanations.filter(row => row.question_id === item.question_id);
      if (!Array.isArray(item.options) || item.options.length < 2 || canonical.length !== item.options.length || questionExplanations.length > 1
          || item.options.some(option => !nonblank(option.label) || !nonblank(option.text))
          || canonical.some(answer => !nonblank(answer.choice_text))
          || new Set(item.options.map(option => option.label)).size !== item.options.length
          || new Set(item.options.map(option => option.text)).size !== item.options.length
          || new Set(canonical.map(answer => answer.choice_text)).size !== canonical.length
          || item.options.some(option => !canonical.some(answer => answer.choice_text === option.text))) continue;
      const content: PaidExplanation = {};
      if (nonblank(questionExplanations[0]?.explanation_text)) content.explanation = questionExplanations[0].explanation_text;
      const options = item.options.flatMap(option => {
        const answer = canonical.find(answer => answer.choice_text === option.text)!;
        return nonblank(answer.explanation_text) ? [{ label: option.label, text: option.text, explanation: answer.explanation_text }] : [];
      });
      if (options.length) content.optionExplanations = options;
      if (content.explanation || content.optionExplanations) result.set(item.id, content);
    }
  } catch { /* No unverified content crosses the paid boundary. */ }
  return result;
}

/** Always start from a public-field whitelist, never the raw database row. */
export function addPaidReview(review: QuestionReview, content?: PaidExplanation): PaidQuestionReview {
  return {
    ...review,
    ...(content?.explanation ? { explanation: content.explanation } : {}),
    options: review.options.map(option => {
      const explanation = content?.optionExplanations?.find(row => row.label === option.label && row.text === option.text)?.explanation;
      return { label: option.label, text: option.text, ...(explanation ? { explanation } : {}) };
    }),
  };
}
