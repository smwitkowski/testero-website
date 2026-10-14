/** Return a shuffled copy using Fisher-Yates. Never mutate database rows. */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function answerLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Shuffle once at session creation. Persist display labels and correctness together. */
export function createAnswerSnapshot(
  answers: readonly { text: string; is_correct: boolean }[]
) {
  const shuffled = shuffleArray(answers);
  const correctIndex = shuffled.findIndex((answer) => answer.is_correct);
  return {
    options: shuffled.map((answer, index) => ({ label: answerLabel(index), text: answer.text })),
    correct_label: correctIndex < 0 ? "" : answerLabel(correctIndex),
  };
}

/** Validate a standalone question's display order against server-owned answer IDs. */
export function resolveAnswerOrder<T extends { id: unknown }>(
  answers: readonly T[],
  optionOrder: unknown
): T[] | null {
  if (!Array.isArray(optionOrder) || optionOrder.length !== answers.length) return null;
  if (optionOrder.some((id) => typeof id !== "string") || new Set(optionOrder).size !== answers.length) {
    return null;
  }
  const byId = new Map(answers.map((answer) => [String(answer.id), answer]));
  const ordered = optionOrder.map((id) => byId.get(id));
  return ordered.every((answer): answer is T => answer !== undefined) ? ordered : null;
}

// "Correct Answer (A)", "Distractor B", "Option C", "answer D" and a paragraph-leading "A:" or "A)".
// Letters are uppercase only, so prose such as "an option a user picks" is untouched.
const LETTER_REFERENCE = /(\b(?:[Cc]orrect [Aa]nswer|[Aa]nswer|[Dd]istractor|[Oo]ption|[Cc]hoice)\s*\(?)([A-Z])(?![A-Za-z0-9])|((?:^|\n)[ \t]*)([A-Z])(?=[:)]\s)/g;

/**
 * Stored explanations name options by their bank letters, but display order is shuffled.
 * Rewrite letter references to the displayed letters in one pass (so A->B and B->A never
 * chain). Letters with no mapping are left as written. Display only: never persist the result.
 */
export function relabelExplanation(text: string, displayLabelFor: ReadonlyMap<string, string>): string {
  return text.replace(LETTER_REFERENCE, (match, prefix: string | undefined, letter: string | undefined, linePrefix: string | undefined, lineLetter: string | undefined) => {
    const original = letter ?? lineLetter!;
    const shown = displayLabelFor.get(original);
    if (!shown) return match;
    return letter !== undefined ? `${prefix}${shown}` : `${linePrefix}${shown}`;
  });
}
