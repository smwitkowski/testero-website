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
