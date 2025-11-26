/**
 * Serializes question and answer data from database format to API response format.
 * Maps canonical schema columns (choice_label, choice_text) to frontend format (label, text).
 * Ensures IDs are always strings to avoid bigint precision issues and align with client types.
 */
export function serializeQuestion(
  q: { id: unknown; stem: string },
  answers: Array<{ id: unknown; choice_label: string; choice_text: string } | { id: unknown; label: string; text: string }>
) {
  return {
    id: String(q.id),
    question_text: q.stem,
    options: (answers || []).map((a) => ({
      id: String(a.id),
      // Support both canonical schema (choice_label, choice_text) and legacy (label, text)
      label: 'choice_label' in a ? a.choice_label : a.label,
      text: 'choice_text' in a ? a.choice_text : a.text,
    })),
  };
}

