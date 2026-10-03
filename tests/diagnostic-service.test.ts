import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDiagnostic, readDiagnostic, answerDiagnostic, diagnosticResults } from "@/lib/diagnostic/service";
import { hashAnonymousToken } from "@/lib/diagnostic/ownership";
import { selectPmleQuestionsByBlueprint, type SelectionResult } from "@/lib/diagnostic/pmle-selection";

vi.mock("@/lib/diagnostic/pmle-selection", async (original) => ({
  ...await original<typeof import("@/lib/diagnostic/pmle-selection")>(),
  selectPmleQuestionsByBlueprint: vi.fn(),
}));
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const token = "a".repeat(64);
const now = Date.parse("2026-10-03T12:00:00Z");
const credentials = { userId: null, anonymousToken: token };
const foreign = { userId: null, anonymousToken: "b".repeat(64) };
function session(overrides = {}) {
  return { id: sessionId, user_id: null, anonymous_owner_hash: hashAnonymousToken(token),
    question_count: 20, expires_at: "2026-10-04T12:00:00Z", completed_at: null, ...overrides };
}
function items() {
  return Array.from({ length: 20 }, (_, index) => ({
    id: index === 0 ? itemId : `item-${index}`, ordinal: index + 1, stem: `Secret stem ${index}`,
    options: [{ label: "A", text: "Display only", is_correct: true, explanation: "secret" }, { label: "B", text: "Other" }],
    domain_code: "A", domain_name: "Domain A", is_correct: null as boolean | null,
    answered_at: null as string | null, correct_label: "A", explanation: "secret explanation",
  }));
}
function selected(): SelectionResult {
  return { domainDistribution: [], questions: Array.from({ length: 20 }, (_, index) => ({
    id: `question-${index}`, stem: `Stem ${index}`, domain_id: "domain", domain_code: "A", domain_name: "Domain A", difficulty: null,
    answers: [{ choice_label: "A", choice_text: "correct", is_correct: true }, { choice_label: "B", choice_text: "wrong", is_correct: false }],
  })) };
}
function database(options: { session?: unknown; items?: unknown; sessionError?: boolean; itemsError?: boolean; rpcData?: unknown; rpcError?: { code: string; message: string } } = {}) {
  const from = vi.fn((table: string) => {
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: options.session === undefined ? session() : options.session, error: options.sessionError ? { message: "secret db" } : null })),
      order: vi.fn(async () => ({ data: options.items === undefined ? items() : options.items, error: options.itemsError ? { message: "secret db" } : null })),
    };
    expect(["study_sessions", "session_items"]).toContain(table);
    return query;
  });
  const rpc = vi.fn(async () => ({ data: options.rpcData === undefined ? sessionId : options.rpcData, error: options.rpcError ?? null }));
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc };
}
beforeEach(() => {
  vi.mocked(selectPmleQuestionsByBlueprint).mockReset().mockResolvedValue(selected());
});

describe("atomic anonymous diagnostic creation", () => {
  it("persists 20 unique snapshots, shuffled labels and their correct key together", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const db = database();
    expect(await createDiagnostic(db.client, token, now)).toBe(sessionId);
    expect(selectPmleQuestionsByBlueprint).toHaveBeenCalledWith(db.client, 20);
    expect(db.rpc).toHaveBeenCalledOnce();
    const [name, args] = db.rpc.mock.calls[0] as unknown as [string, { p_items: { question_id: string; options: { label: string; text: string }[]; correct_label: string }[]; p_anonymous_owner_hash: string; p_expires_at: string; p_user_id: null }];
    expect(name).toBe("create_study_session");
    expect(args.p_items).toHaveLength(20);
    expect(new Set(args.p_items.map((i) => i.question_id)).size).toBe(20);
    expect(args.p_items[0].options).toEqual([{ label: "A", text: "wrong" }, { label: "B", text: "correct" }]);
    expect(args.p_items[0].correct_label).toBe("B");
    expect(args.p_user_id).toBeNull();
    expect(args.p_anonymous_owner_hash).toBe(hashAnonymousToken(token));
    expect(args.p_anonymous_owner_hash).not.toBe(token);
    expect(args.p_expires_at).toBe("2026-10-04T12:00:00.000Z");
  });
  it("rejects invalid token before querying the bank or RPC", async () => {
    const db = database();
    await expect(createDiagnostic(db.client, "bad", now)).rejects.toMatchObject({ status: 400 });
    expect(selectPmleQuestionsByBlueprint).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each(["insufficient", "query secret failure"])("sanitizes selector error %s", async (message) => {
    vi.mocked(selectPmleQuestionsByBlueprint).mockRejectedValue(new Error(message));
    const db = database();
    await expect(createDiagnostic(db.client, token, now)).rejects.toMatchObject({ status: 503, message: "The diagnostic is unavailable. Please try again." });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each(["short", "duplicate", "no answers", "multiple keys", "blank stem"])("rejects invalid selected bank %s before RPC", async (kind) => {
    const pool = selected();
    if (kind === "short") pool.questions.pop();
    if (kind === "duplicate") pool.questions[1].id = pool.questions[0].id;
    if (kind === "no answers") pool.questions[0].answers = [];
    if (kind === "multiple keys") pool.questions[0].answers[1].is_correct = true;
    if (kind === "blank stem") pool.questions[0].stem = " ";
    vi.mocked(selectPmleQuestionsByBlueprint).mockResolvedValue(pool);
    const db = database();
    await expect(createDiagnostic(db.client, token, now)).rejects.toMatchObject({ status: 503 });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, "not-a-uuid"])("rejects malformed creation RPC response %#", async (rpcData) => {
    await expect(createDiagnostic(database({ rpcData }).client, token, now)).rejects.toMatchObject({ status: 503 });
  });
  it("sanitizes RPC failures", async () => {
    await expect(createDiagnostic(database({ rpcError: { code: "XX000", message: "secret" } }).client, token, now))
      .rejects.toMatchObject({ status: 503, message: "The diagnostic is unavailable. Please try again." });
  });
});

describe("ownership-first reads and results", () => {
  it.each(["read", "answer", "results"])("malformed session UUID makes no DB calls: %s", async (operation) => {
    const db = database();
    const call = operation === "read" ? readDiagnostic(db.client, "bad", credentials, now)
      : operation === "answer" ? answerDiagnostic(db.client, "bad", credentials, itemId, "A", now)
      : diagnosticResults(db.client, "bad", credentials, now);
    await expect(call).rejects.toMatchObject({ status: 404 });
    expect(db.from).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each(["read", "answer", "results"])("foreign ownership blocks item reads and RPC: %s", async (operation) => {
    const db = database();
    const call = operation === "read" ? readDiagnostic(db.client, sessionId, foreign, now)
      : operation === "answer" ? answerDiagnostic(db.client, sessionId, foreign, itemId, "A", now)
      : diagnosticResults(db.client, sessionId, foreign, now);
    await expect(call).rejects.toMatchObject({ status: 404 });
    expect(db.from.mock.calls).toEqual([["study_sessions"]]); expect(db.rpc).not.toHaveBeenCalled();
  });
  it("expired foreign sessions remain 404; only owner sees 410", async () => {
    const db = database({ session: session({ expires_at: "2026-10-03T11:00:00Z" }) });
    await expect(readDiagnostic(db.client, sessionId, foreign, now)).rejects.toMatchObject({ status: 404 });
    await expect(readDiagnostic(db.client, sessionId, credentials, now)).rejects.toMatchObject({ status: 410 });
    expect(db.from.mock.calls.every(([table]) => table === "study_sessions")).toBe(true);
  });
  it("whitelists current question and options even when stored options contain secret fields", async () => {
    const db = database();
    const result = await readDiagnostic(db.client, sessionId, credentials, now);
    expect(result).toEqual({ sessionId, status: "in_progress", totalQuestions: 20, answeredCount: 0,
      currentQuestion: { id: itemId, ordinal: 1, stem: "Secret stem 0", options: [{ label: "A", text: "Display only" }, { label: "B", text: "Other" }] } });
    expect(JSON.stringify(result)).not.toMatch(/is_correct|correct_label|explanation|domain_code/);
  });
  it("reads the next unanswered item without exposing previous questions", async () => {
    const rows = items(); rows[0].answered_at = "2026-10-03T11:00:00Z"; rows[0].is_correct = true;
    const result = await readDiagnostic(database({ items: rows }).client, sessionId, credentials, now);
    expect(result.answeredCount).toBe(1); expect(result.currentQuestion?.ordinal).toBe(2);
  });
  it("does not expose questions on completed progress", async () => {
    const rows = items().map((i) => ({ ...i, answered_at: "2026-10-03T11:00:00Z", is_correct: true }));
    const result = await readDiagnostic(database({ session: session({ completed_at: "done" }), items: rows }).client, sessionId, credentials, now);
    expect(result.currentQuestion).toBeNull(); expect(result.status).toBe("completed"); expect(result.answeredCount).toBe(20);
  });
  it.each([null, []])("fails closed for missing/inconsistent items %#", async (rows) => {
    await expect(readDiagnostic(database({ items: rows }).client, sessionId, credentials, now)).rejects.toMatchObject({ status: 503 });
  });
  it("returns completed progress when final-answer rows arrive after stale session metadata", async () => {
    // The session read can precede the final answer transaction, while the item
    // read follows it. Infer completion from the full answered snapshot.
    const rows = items().map((i) => ({ ...i, answered_at: "2026-10-03T11:00:00Z", is_correct: true }));
    const result = await readDiagnostic(database({ session: session({ completed_at: null }), items: rows }).client, sessionId, credentials, now);
    expect(result).toEqual({ sessionId, status: "completed", totalQuestions: 20, answeredCount: 20, currentQuestion: null });
    expect(JSON.stringify(result)).not.toMatch(/stem|options|correct_label|is_correct|explanation/);
  });
  it("returns 409 without reading items for an incomplete result", async () => {
    const db = database();
    await expect(diagnosticResults(db.client, sessionId, credentials, now)).rejects.toMatchObject({ status: 409 });
    expect(db.from.mock.calls).toEqual([["study_sessions"]]);
  });
  it("returns completed aggregates only, including after session expiry", async () => {
    const rows = items().map((i, index) => ({ ...i, answered_at: "done", is_correct: index < 17 }));
    const db = database({ session: session({ completed_at: "done", expires_at: "2026-10-01T12:00:00Z" }), items: rows });
    const result = await diagnosticResults(db.client, sessionId, credentials, now);
    expect(result).toMatchObject({ sessionId, score: 85, totalQuestions: 20, correctAnswers: 17, readiness: { id: "strong" } });
    expect(result.domainBreakdown).toEqual([{ domainCode: "A", domainName: "Domain A", total: 20, correct: 17, percentage: 85 }]);
    expect(JSON.stringify(result)).not.toMatch(/question_id|items|stem|options|correct_label|is_correct|explanation|bbbbbbbb/i);
  });
  it("rejects incomplete/malformed result item data", async () => {
    await expect(diagnosticResults(database({ session: session({ completed_at: "done" }) }).client, sessionId, credentials, now))
      .rejects.toMatchObject({ status: 503 });
  });
  it.each(["sessionError", "itemsError"] as const)("sanitizes DB read failures: %s", async (key) => {
    await expect(readDiagnostic(database({ [key]: true }).client, sessionId, credentials, now)).rejects.toMatchObject({ status: 503 });
  });
});

describe("ownership-first answer RPC", () => {
  it("passes server-owned owner identity and whitelists progress on retry", async () => {
    const db = database({ rpcData: { answeredCount: 1, totalQuestions: 20, completed: false, is_correct: true, correct_label: "A", explanation: "secret" } });
    for (let retry = 0; retry < 2; retry++) {
      expect(await answerDiagnostic(db.client, sessionId, credentials, itemId, "A", now))
        .toEqual({ answeredCount: 1, totalQuestions: 20, completed: false });
    }
    expect(db.rpc).toHaveBeenCalledWith("answer_study_item", { p_session_id: sessionId, p_item_id: itemId, p_selected_label: "A", p_user_id: null, p_anonymous_owner_hash: hashAnonymousToken(token) });
  });
  it.each([
    { answeredCount: -1, totalQuestions: 20, completed: false },
    { answeredCount: 21, totalQuestions: 20, completed: true },
    { answeredCount: 0.5, totalQuestions: 20, completed: false },
    { answeredCount: 1, totalQuestions: 19, completed: false },
    { answeredCount: 1, totalQuestions: 20, completed: true },
    { answeredCount: 20, totalQuestions: 20, completed: false },
    { answeredCount: 1, totalQuestions: 20, completed: "false" },
    null,
  ].map((rpcData) => ({ rpcData })))("rejects malformed RPC progress %#", async ({ rpcData }) => {
    await expect(answerDiagnostic(database({ rpcData }).client, sessionId, credentials, itemId, "A", now)).rejects.toMatchObject({ status: 503 });
  });
  it("accepts a consistent completion response", async () => {
    expect(await answerDiagnostic(database({ rpcData: { answeredCount: 20, totalQuestions: 20, completed: true } }).client, sessionId, credentials, itemId, "A", now))
      .toEqual({ answeredCount: 20, totalQuestions: 20, completed: true });
  });
  it.each([
    ["42501", "Foreign owner", 404], ["22023", "Session expired", 410],
    ["22023", "Answer out of order", 409], ["22023", "Already answered differently", 409],
    ["XX000", "secret", 503],
  ])("maps RPC error %s/%s to %s", async (code, message, status) => {
    const db = database({ rpcError: { code: String(code), message: String(message) } });
    await expect(answerDiagnostic(db.client, sessionId, credentials, itemId, "A", now)).rejects.toMatchObject({ status });
  });
});
