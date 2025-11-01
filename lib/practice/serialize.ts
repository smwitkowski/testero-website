/**
 * Serializes question and option data from database format to API response format.
 * Ensures IDs are always strings to avoid bigint precision issues and align with client types.
 */
export function serializeQuestion(
  q: { id: unknown; stem: string },
  options: Array<{ id: unknown; label: string; text: string }>
) {
  return {
    id: String(q.id),
    question_text: q.stem,
    options: (options || []).map((o) => ({
      id: String(o.id),
      label: o.label,
      text: o.text,
    })),
  };
}

