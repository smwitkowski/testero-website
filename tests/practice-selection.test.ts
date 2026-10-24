import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { freshFirst, loadAnswerHistory, selectWeakArea, type AnswerHistory } from "@/lib/practice/selection";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const first = PMLE_BLUEPRINT[0].domainCode;
const second = PMLE_BLUEPRINT[1].domainCode;
function answers(domainCode = first, count = 5, correct = 0, overrides: Partial<AnswerHistory> = {}): AnswerHistory[] {
  return Array.from({ length: count }, (_, index) => ({ questionId: `${domainCode}-${index}`, domainCode, isCorrect: index < correct, kind: "practice", sessionId: "practice-1", answeredAt: "2026-10-24T12:00:00Z", completedAt: null, ...overrides }));
}
afterEach(() => vi.restoreAllMocks());
describe("fresh-first selection", () => {
  it("puts all unseen questions before seen questions without mutating the bank", () => {
    const bank = Array.from({ length: 8 }, (_, index) => ({ id: String(index) }));
    const original = [...bank]; const seen = new Set(["0", "2", "4", "6"]);
    for (let attempt = 0; attempt < 20; attempt++) {
      const selected = freshFirst(bank, seen);
      expect(selected.slice(0, 4).every(question => !seen.has(question.id))).toBe(true);
      expect(selected.slice(4).every(question => seen.has(question.id))).toBe(true);
      expect(new Set(selected.map(question => question.id)).size).toBe(8);
    }
    expect(bank).toEqual(original);
  });
  it("falls back to seen inventory only after the unseen pool runs out", () => {
    const bank = [{ id: "seen-1" }, { id: "fresh" }, { id: "seen-2" }];
    const selected = freshFirst(bank, new Set(["seen-1", "seen-2"]));
    expect(selected[0].id).toBe("fresh"); expect(selected).toHaveLength(3);
    expect(freshFirst([], new Set())).toEqual([]);
  });
});
describe("weak-area selection", () => {
  it("selects the lowest score among domains with at least five distinct answered questions", () => {
    const result = selectWeakArea([...answers(first, 5, 4), ...answers(second, 5, 1)]);
    expect(result).toMatchObject({ reason: "history", domainCode: second });
    expect(result.message).toContain("at least 5");
  });
  it("does not let one wrong answer or repeated attempts at one question define weakness", () => {
    expect(selectWeakArea([...answers(first, 5, 5), ...answers(second, 1)])).toMatchObject({ reason: "history", domainCode: first });
    expect(selectWeakArea(answers(second, 10, 0, { questionId: "same" }))).toMatchObject({ reason: "general" });
  });
  it("combines diagnostic and practice history toward the threshold", () => {
    expect(selectWeakArea([...answers(second, 3), ...answers(second, 2, 0, { kind: "diagnostic", sessionId: "diag", questionId: "diag-other" }), ...answers(second, 1, 0, { questionId: "fifth" })])).toMatchObject({ reason: "history", domainCode: second });
  });
  it("falls back to the latest completed diagnostic's weakest study focus", () => {
    const old = answers(first, 2, 0, { kind: "diagnostic", sessionId: "old", completedAt: "2026-10-20T12:00:00Z" });
    const latest = [...answers(first, 2, 2), ...answers(second, 2, 0)].map(row => ({ ...row, kind: "diagnostic" as const, sessionId: "latest", completedAt: "2026-10-24T12:00:00Z" }));
    expect(selectWeakArea([...old, ...latest])).toMatchObject({ reason: "diagnostic_focus", domainCode: second });
  });
  it("ignores incomplete diagnostics as a fallback and gives an honest no-history reason", () => {
    const result = selectWeakArea(answers(second, 2, 0, { kind: "diagnostic" }));
    expect(result.reason).toBe("general"); expect(result.message).toContain("Not enough");
  });
  it("does not treat unscored mock answers as wrong or infer weak drills from mocks", () => {
    const history = [...answers(first, 5, 3), ...answers(second, 8, 0, { kind: "mock", isCorrect: null })];
    expect(selectWeakArea(history)).toMatchObject({ reason: "history", domainCode: first });
  });
  it("breaks score ties in blueprint order", () => {
    expect(selectWeakArea([...answers(second), ...answers(first)])).toMatchObject({ reason: "history", domainCode: first });
  });
});

function historyDb(study: unknown[], mock: unknown[] = [], errorTable?: string) {
  const calls: { table: string; filters: unknown[][]; fields: string; range: number[] }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, filters: [] as unknown[][], fields: "", range: [0, 999] }; calls.push(call);
    const query = {
      select: (fields: string) => { call.fields = fields; return query; },
      eq: (...args: unknown[]) => { call.filters.push(args); return query; },
      not: (...args: unknown[]) => { call.filters.push(args); return query; },
      in: (...args: unknown[]) => { call.filters.push(args); return query; },
      order: () => query,
      range: (start: number, end: number) => { call.range = [start, end]; return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: (table === "session_items" ? study : mock).slice(call.range[0], call.range[1] + 1), error: table === errorTable ? { message: "secret SDK error" } : null }).then(resolve),
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, calls };
}
function historyRow(mock = false, overrides: Record<string, unknown> = {}) {
  return { id: "item", question_id: "question", domain_code: first, is_correct: mock ? null : false, answered_at: "2026-10-24T12:00:00Z", session_id: "session", [mock ? "mock_exam_sessions" : "study_sessions"]: { user_id: userId, completed_at: null, ...(mock ? {} : { kind: "diagnostic", exam: "GCP_PM_ML_ENG" }) }, ...overrides };
}
describe("owned cross-session answer history", () => {
  it("unions diagnostic/practice with answered but unscored mock questions and binds both joins to owner", async () => {
    const database = historyDb([historyRow()], [historyRow(true, { question_id: "mock-question" })]);
    const history = await loadAnswerHistory(database.client, userId);
    expect(history).toHaveLength(2); expect(history[1]).toMatchObject({ questionId: "mock-question", kind: "mock", isCorrect: null });
    expect(database.calls[0].filters).toContainEqual(["study_sessions.user_id", userId]);
    expect(database.calls[0].filters).toContainEqual(["study_sessions.exam", "GCP_PM_ML_ENG"]);
    expect(database.calls[1].filters).toContainEqual(["mock_exam_sessions.user_id", userId]);
    for (const call of database.calls) expect(call.filters).toContainEqual(["answered_at", "is", null]);
  });
  it("reads beyond the default thousand-row database limit", async () => {
    const database = historyDb(Array.from({ length: 1001 }, (_, index) => historyRow(false, { id: `item-${index}`, question_id: `question-${index}` })));
    expect(await loadAnswerHistory(database.client, userId)).toHaveLength(1001);
    expect(database.calls[1].range).toEqual([1000, 1999]);
  });
  it.each(["session_items", "mock_exam_items"])("fails closed when %s history cannot be read", async table => {
    await expect(loadAnswerHistory(historyDb([], [], table).client, userId)).rejects.toMatchObject({ status: 503 });
  });
  it.each([{ study_sessions: { user_id: "other" } }, { study_sessions: null }, { answered_at: null }, { is_correct: "wrong" }, { study_sessions: { user_id: userId, kind: "practice", exam: "other" } }])("defensively rejects malformed or foreign history %#", async override => {
    await expect(loadAnswerHistory(historyDb([historyRow(false, override)]).client, userId)).rejects.toMatchObject({ status: 503 });
  });
});
