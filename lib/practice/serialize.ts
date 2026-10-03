/**
 * Serializes question and answer data from database format to API response format.
 * Assigns display labels by position and maps choice_text to text.
 * Ensures IDs are always strings to avoid bigint precision issues and align with client types.
 */
import { answerLabel } from "@/lib/questions/answer-order";

export function serializeQuestion(
  q: { id: unknown; stem: string },
  answers: Array<{ id: unknown; choice_label: string; choice_text: string } | { id: unknown; label: string; text: string }>
) {
  return {
    id: String(q.id),
    question_text: q.stem,
    options: (answers || []).map((a, index) => ({
      id: String(a.id),
      // Display labels follow the supplied order; stable IDs identify submitted answers.
      label: answerLabel(index),
      text: 'choice_text' in a ? a.choice_text : a.text,
    })),
  };
}

