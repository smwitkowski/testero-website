import "server-only";

export interface WithdrawalSnapshot {
  withdrawn_at?: string | null;
  questions?: { status: string; review_status: string } | null;
}
export const liveSessionItem = (item: WithdrawalSnapshot) => item.withdrawn_at == null
  && item.questions?.status === "ACTIVE" && item.questions.review_status === "GOOD";
// Pre-C rows have no marker. Keep the old live fence until migration C is installed.
export const includedSessionItem = (item: WithdrawalSnapshot, completed: boolean) =>
  item.withdrawn_at === undefined ? liveSessionItem(item) : item.withdrawn_at === null && (completed || liveSessionItem(item));

/** Retry only the known missing-column deploy window, never permission/network errors. */
export async function readWithdrawalSnapshot<T extends { error: { code?: string; message?: string } | null }>(read: (withMarker: boolean) => PromiseLike<T>): Promise<T> {
  const result = await read(true);
  return result.error && ["42703", "PGRST204"].includes(result.error.code ?? "") && result.error.message?.includes("withdrawn_at")
    ? await read(false) : result;
}
