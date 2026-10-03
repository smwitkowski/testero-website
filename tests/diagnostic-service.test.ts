import { loadPaidExplanations } from "@/lib/billing/explanations";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDiagnostic, readDiagnostic, answerDiagnostic, diagnosticResults } from "@/lib/diagnostic/service";
import { hashAnonymousToken } from "@/lib/diagnostic/ownership";
import { selectPmleQuestionsByBlueprint, type SelectionResult } from "@/lib/diagnostic/pmle-selection";

vi.mock("@/lib/billing/explanations", async original => ({ ...await original<typeof import("@/lib/billing/explanations")>(), loadPaidExplanations: vi.fn() }));
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: vi.fn() }));
const freeAccess = { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null };
beforeEach(() => { vi.mocked(getPaidAccess).mockReset().mockResolvedValue(freeAccess); vi.mocked(loadPaidExplanations).mockReset().mockResolvedValue(new Map()); });

vi.mock("@/lib/diagnostic/pmle-selection", async (original) => ({
  ...await original<typeof import("@/lib/diagnostic/pmle-selection")>(),
  selectPmleQuestionsByBlueprint: vi.fn(),
}));
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const token = "a".repeat(64);
const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherUserId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const signedIn = { userId, anonymousToken: token };
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
    answered_at: null as string | null, selected_label: "A", correct_label: "A", explanation: "secret explanation",
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


describe("account-owned diagnostic review", () => {
  function completedItems() {
    return items().map((item, index) => ({ ...item, answered_at: "done", is_correct: index !== 0, selected_label: index === 0 ? "B" : "A", source: "secret source", question_id: "secret bank id", document_url: "secret link" }));
  }
  function accountSession(overrides = {}) {
    return session({ user_id: userId, anonymous_owner_hash: null, completed_at: "done", ...overrides });
  }
  it("creates a user-owned retake without attaching the retained anonymous cookie", async () => {
    const db = database();
    expect(await createDiagnostic(db.client, token, now, userId)).toBe(sessionId);
    expect(db.rpc).toHaveBeenCalledWith("create_study_session", expect.objectContaining({ p_user_id: userId, p_anonymous_owner_hash: null }));
  });
  it("rejects malformed user identity before bank reads", async () => {
    const db = database();
    await expect(createDiagnostic(db.client, token, now, "bad-user")).rejects.toMatchObject({ status: 400 });
    expect(selectPmleQuestionsByBlueprint).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("returns whitelisted review only for a matching verified owner", async () => {
    const db = database({ session: accountSession(), items: completedItems() });
    const result = await diagnosticResults(db.client, sessionId, signedIn, now);
    expect(Object.keys(result)).toHaveLength(7);
    expect(result.review).toHaveLength(20);
    expect(result.review?.[0]).toEqual({ itemId, ordinal: 1, stem: "Secret stem 0", options: [{ label: "A", text: "Display only" }, { label: "B", text: "Other" }], selectedLabel: "B", correctLabel: "A", isCorrect: false, domainCode: "A", domainName: "Domain A" });
    expect(JSON.stringify(result)).not.toMatch(/explanation|is_correct|correct_label|source|document_url|question_id|secret bank/);
    expect(db.from.mock.results[1].value.select).toHaveBeenCalledWith(expect.stringContaining("correct_label,selected_label"));
  });
  it("signed-in visitors to anonymous-owned sessions still receive exactly six aggregate fields", async () => {
    const db = database({ session: session({ completed_at: "done" }), items: completedItems() });
    const result = await diagnosticResults(db.client, sessionId, signedIn, now);
    expect(Object.keys(result).sort()).toEqual(["correctAnswers", "domainBreakdown", "readiness", "score", "sessionId", "totalQuestions"]);
    expect(JSON.stringify(result)).not.toMatch(/review|stem|options|correctLabel|selectedLabel|explanation/);
    expect(db.from.mock.results[1].value.select).not.toHaveBeenCalledWith(expect.stringContaining("correct_label"));
  });
  it.each([credentials, { userId: otherUserId, anonymousToken: token }, { userId: null, anonymousToken: null }])("blocks foreign/logged-out former anonymous owner before question reads %#", async (owner) => {
    const db = database({ session: accountSession(), items: completedItems() });
    await expect(diagnosticResults(db.client, sessionId, owner, now)).rejects.toMatchObject({ status: 404 });
    expect(db.from.mock.calls).toEqual([["study_sessions"]]);
  });
  it("does not reveal correctness or review during account-owned progress", async () => {
    const db = database({ session: accountSession({ completed_at: null }), items: items() });
    const progress = await readDiagnostic(db.client, sessionId, signedIn, now);
    expect(JSON.stringify(progress)).not.toMatch(/review|correctLabel|selectedLabel|isCorrect|correct_label|selected_label|explanation/);
    expect(db.from.mock.results[1].value.select).not.toHaveBeenCalledWith(expect.stringContaining("correct_label"));
  });
  it("does not read question review before completion", async () => {
    const db = database({ session: accountSession({ completed_at: null }) });
    await expect(diagnosticResults(db.client, sessionId, signedIn, now)).rejects.toMatchObject({ status: 409 });
    expect(db.from.mock.calls).toEqual([["study_sessions"]]);
  });
  it.each([null, "Z"])('fails closed for missing or invalid review labels: %s', async label => {
    const rows = completedItems().map(item => ({ ...item, selected_label: label }));
    await expect(diagnosticResults(database({ session: accountSession(), items: rows }).client, sessionId, signedIn, now)).rejects.toMatchObject({ status: 503 });
  });
});


describe("paid diagnostic review remains completion- and ownership-gated", () => {
  const paid = { ...freeAccess, hasPaidAccess: true };
  const completed = () => items().map(item => ({ ...item, answered_at: "done", is_correct: true, question_id: "bank-secret" }));
  const owned = () => session({ user_id: userId, anonymous_owner_hash: null, completed_at: "done" });
  it("paid signed-in owner gets safe review then refund redacts on next read", async () => {
    vi.mocked(getPaidAccess).mockResolvedValueOnce(paid).mockResolvedValueOnce({ ...freeAccess, unavailable: true });
    vi.mocked(loadPaidExplanations).mockResolvedValue(new Map([[itemId, { explanation: "Question reason", optionExplanations: [{ label: "A", text: "Display only", explanation: "Option reason" }] }]]));
    const db = database({ session: owned(), items: completed() });
    const result = await diagnosticResults(db.client, sessionId, signedIn, now);
    expect(result.review?.[0].explanation).toBe("Question reason"); expect(result.review?.[0].options[0].explanation).toBe("Option reason");
    expect(JSON.stringify(result)).not.toMatch(/bank-secret|question_id|document_url|source|is_correct/);
    expect(JSON.stringify(await diagnosticResults(db.client, sessionId, signedIn, now))).not.toMatch(/explanation|reason/);
    expect(getPaidAccess).toHaveBeenCalledTimes(2); expect(loadPaidExplanations).toHaveBeenCalledOnce();
  });
  it("paid visitors still receive exactly six anonymous aggregate fields", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue(paid);
    const result = await diagnosticResults(database({ session: session({ completed_at: "done" }), items: completed() }).client, sessionId, signedIn, now);
    expect(Object.keys(result).sort()).toEqual(["correctAnswers", "domainBreakdown", "readiness", "score", "sessionId", "totalQuestions"]);
    expect(getPaidAccess).not.toHaveBeenCalled(); expect(loadPaidExplanations).not.toHaveBeenCalled();
  });
  it("paid status never leaks pre-answer correctness, explanations, or review", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue(paid);
    const db = database({ session: { ...owned(), completed_at: null }, rpcData: { answeredCount: 1, totalQuestions: 20, completed: false } });
    expect(JSON.stringify(await readDiagnostic(db.client, sessionId, signedIn, now))).not.toMatch(/correctLabel|explanation|review/);
    expect(await answerDiagnostic(db.client, sessionId, signedIn, itemId, "A", now)).toEqual({ answeredCount: 1, totalQuestions: 20, completed: false });
    expect(getPaidAccess).not.toHaveBeenCalled(); expect(loadPaidExplanations).not.toHaveBeenCalled();
  });
});
