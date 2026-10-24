import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { loadPaidExplanations } from "@/lib/billing/explanations";
import { loadAnswerHistory } from "@/lib/practice/selection";
import { createMock, readMock, answerMock, submitMock, mockResults, mockHistory } from "@/lib/mock/service";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: vi.fn() }));
vi.mock("@/lib/billing/explanations", async original => ({ ...await original<typeof import("@/lib/billing/explanations")>(), loadPaidExplanations: vi.fn() }));
vi.mock("@/lib/practice/selection", () => ({ loadAnswerHistory: vi.fn() }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const paid = { hasPaidAccess: true, isLegacySubscriber: false, accessUntil: null, pass: null };
const free = { ...paid, hasPaidAccess: false };
const session = { id, user_id: user, question_count: 50, created_at: "2026-10-24T10:00:00Z", deadline_at: "2026-10-24T12:00:00Z", completed_at: null as string | null, timed_out: false, allocation_notice: null, server_now: "2026-10-24T10:30:00Z", answered_count: 0 };
function rows() { return Array.from({ length: 50 }, (_, n) => ({ questions: { status: "ACTIVE", review_status: "GOOD" }, id: n ? `item-${n}` : itemId, question_id: `bank-${n}`, ordinal: n + 1, stem: `Question ${n}`, domain_code: PMLE_BLUEPRINT[n % 6].domainCode, domain_name: `Domain ${n % 6}`, options: [{ label: "A", text: "Correct", explanation: "private injected" }, { label: "B", text: "Wrong" }], correct_label: "A", selected_label: null as string | null, is_correct: null as boolean | null, answered_at: null as string | null, explanation: "private injected" })); }
function bank() { return PMLE_BLUEPRINT.flatMap((domain, i) => Array.from({ length: 15 }, (_, n) => ({ id: `${i}-${n}`, parent_question_id: null, stem: `Question ${i}-${n}`, exam_domains: { code: domain.domainCode, name: domain.displayName }, answers: [{ choice_label: "A", choice_text: "Correct", is_correct: true }, { choice_label: "B", choice_text: "Wrong", is_correct: false }] }))); }
interface Options { session?: unknown; rows?: unknown; bank?: unknown; history?: unknown; rpcError?: { code: string }; errorTable?: string; expired?: boolean; foreign?: boolean }
function db(options: Options = {}) {
  let state = { ...session, ...(options.session as object ?? {}) };
  const items = (options.rows ?? rows()) as ReturnType<typeof rows>;
  const queries: { table: string; filters: [string, unknown][] }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, filters: [] as [string, unknown][] }; queries.push(call);
    const result = () => ({ data: table === "questions" ? options.bank ?? bank() : table === "mock_exam_items" ? items : table === "mock_exam_sessions" ? [state] : [], error: options.errorTable === table ? { code: "XX000" } : null });
    const query = { select: vi.fn(() => query), eq: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }), is: vi.fn(() => query), order: vi.fn(() => query), range: vi.fn(() => query), limit: vi.fn(() => query), then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve) };
    return query;
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (options.rpcError) return { data: null, error: options.rpcError };
    if (options.foreign) return { data: null, error: { code: "P0002" } };
    if (name === "create_mock_exam") return { data: id, error: null };
    if (!state.completed_at && (args.p_action === "submit" || options.expired)) {
      state = { ...state, completed_at: options.expired ? state.deadline_at : state.server_now, timed_out: !!options.expired };
      for (const item of items) item.is_correct = item.selected_label === item.correct_label;
    } else if (!state.completed_at && args.p_action === "answer") {
      const item = items.find(item => item.id === args.p_item_id)!;
      item.selected_label = args.p_selected_label as string; item.answered_at = state.server_now;
    }
    if (name === "mock_exam_history") return { data: options.history ?? [{ ...state, score: state.completed_at ? Math.round(items.filter(item => item.is_correct).length * 100 / 50) : null }], error: null };
    return { data: state, error: null };
  });
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, queries, items };
}
beforeEach(() => {
  vi.mocked(getPaidAccess).mockReset().mockResolvedValue(paid);
  vi.mocked(loadPaidExplanations).mockReset().mockResolvedValue(new Map());
  vi.mocked(loadAnswerHistory).mockReset().mockResolvedValue([]);
});
describe("Pass-only mock boundary", () => {
  it.each(["create", "read", "answer", "submit", "results", "history"])("requires fresh access before %s", async operation => {
    vi.mocked(getPaidAccess).mockResolvedValue(free); const database = db();
    const task = operation === "create" ? createMock(database.client, user) : operation === "read" ? readMock(database.client, id, user) : operation === "answer" ? answerMock(database.client, id, user, itemId, "A") : operation === "submit" ? submitMock(database.client, id, user) : operation === "results" ? mockResults(database.client, id, user) : mockHistory(database.client, user);
    await expect(task).rejects.toMatchObject({ status: 403 }); expect(database.from).not.toHaveBeenCalled(); expect(database.rpc).not.toHaveBeenCalled(); expect(loadPaidExplanations).not.toHaveBeenCalled();
  });
  it("fails closed if paid lookup is unavailable", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue({ ...free, unavailable: true }); await expect(readMock(db().client, id, user)).rejects.toMatchObject({ status: 503 });
  });
  it.each(["read", "answer", "submit", "results"])("does not read items for another owner on %s", async operation => {
    const database = db({ foreign: true });
    const task = operation === "read" ? readMock(database.client, id, user) : operation === "answer" ? answerMock(database.client, id, user, itemId, "A") : operation === "submit" ? submitMock(database.client, id, user) : mockResults(database.client, id, user);
    await expect(task).rejects.toMatchObject({ status: 404 }); expect(database.from).not.toHaveBeenCalled();
  });
  it("denies refunded result retries and a refund during explanation loading", async () => {
    const database = db({ session: { completed_at: session.server_now }, rows: rows().map(row => ({ ...row, is_correct: false })) });
    vi.mocked(getPaidAccess).mockResolvedValueOnce(paid).mockResolvedValue(free);
    await expect(mockResults(database.client, id, user)).rejects.toMatchObject({ status: 403 });
    expect(loadPaidExplanations).toHaveBeenCalledOnce();
    await expect(mockResults(database.client, id, user)).rejects.toMatchObject({ status: 403 });
    expect(loadPaidExplanations).toHaveBeenCalledOnce();
  });
});
describe("mock persistence, deadlines and no early reveal", () => {
  it("resumes saved choices but whitelists every field and nested option", async () => {
    const items = rows(); items[0].selected_label = "B"; items[0].answered_at = session.server_now;
    const result = await readMock(db({ rows: items }).client, id, user);
    expect(result).toMatchObject({ status: "in_progress", totalQuestions: 50, answeredCount: 1, deadlineAt: session.deadline_at });
    expect(result.questions[0].selectedLabel).toBe("B");
    expect(JSON.stringify(result)).not.toMatch(/isCorrect|correctLabel|correct_label|is_correct|explanation|question_id|private/);
  });
  it("saves an answer without correctness, scoring or explanations", async () => {
    const database = db(); const result = await answerMock(database.client, id, user, itemId, "A");
    expect(database.rpc).toHaveBeenCalledWith("interact_mock_exam", { p_user_id: user, p_session_id: id, p_action: "answer", p_item_id: itemId, p_selected_label: "A" });
    expect(result.answeredCount).toBe(1); expect(result.questions[0].selectedLabel).toBe("A");
    expect(JSON.stringify(result)).not.toMatch(/correctLabel|isCorrect|score|explanation/); expect(loadPaidExplanations).not.toHaveBeenCalled();
  });
  it.each(["read", "answer", "results"])("honors atomic expiry auto-submit on %s without saving a late choice", async operation => {
    const database = db({ expired: true });
    const result = operation === "read" ? await readMock(database.client, id, user) : operation === "answer" ? await answerMock(database.client, id, user, itemId, "A") : await mockResults(database.client, id, user);
    if (operation !== "results") expect(result).toMatchObject({ status: "completed", questions: [], answeredCount: 0 });
    else expect(result).toMatchObject({ score: 0, timedOut: true, totalQuestions: 50 });
    expect(database.items[0].selected_label).toBeNull();
  });
  it("submit and timeout score unanswered questions incorrect by domain and load explanations only after completion", async () => {
    const items = rows().map((row, n) => ({ ...row, selected_label: n < 25 ? "A" : n < 40 ? "B" : null, answered_at: n < 40 ? session.server_now : null }));
    const database = db({ rows: items });
    await submitMock(database.client, id, user); const result = await mockResults(database.client, id, user);
    expect(result.score).toBe(50); expect(result.correctAnswers).toBe(25); expect(result.domainBreakdown).toHaveLength(6);
    expect(result.domainBreakdown.reduce((sum, domain) => sum + domain.total, 0)).toBe(50);
    expect(result.domainBreakdown.reduce((sum, domain) => sum + domain.correct, 0)).toBe(25);
    expect(result.review[49]).toMatchObject({ selectedLabel: "Unanswered", isCorrect: false });
    expect(JSON.stringify(result)).not.toMatch(/private|question_id|correct_label/);
    expect(loadPaidExplanations).toHaveBeenCalledOnce();
  });
  it("blocks an incomplete result before reading keys or loading explanations", async () => {
    const database = db(); await expect(mockResults(database.client, id, user)).rejects.toMatchObject({ status: 409 }); expect(database.from).not.toHaveBeenCalled(); expect(loadPaidExplanations).not.toHaveBeenCalled();
  });
  it("lists attempt scores and dates with owner-bound queries", async () => {
    const database = db({ expired: true }); const result = await mockHistory(database.client, user);
    expect(result).toEqual([{ sessionId: id, startedAt: session.created_at, deadlineAt: session.deadline_at, completedAt: session.deadline_at, score: 0, totalQuestions: 50 }]);
    expect(database.rpc).toHaveBeenCalledExactlyOnceWith("mock_exam_history", { p_user_id: user });
    expect(database.from).not.toHaveBeenCalled();
    expect(getPaidAccess).toHaveBeenCalledExactlyOnceWith(user, database.client);
  });
  it("loads 50 mixed attempts with one access lookup and one bulk RPC, with no early score or private fields", async () => {
    const history = Array.from({ length: 50 }, (_, n) => ({ ...session,
      id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`,
      completed_at: n % 3 === 0 ? null : n % 3 === 1 ? session.server_now : session.deadline_at,
      score: n % 3 === 0 ? null : n % 3 === 1 ? 76 : 0,
      correct_label: "A", selected_label: "B", explanation: "private", options: [] }));
    const database = db({ history });
    const result = await mockHistory(database.client, user);
    expect(result).toHaveLength(50);
    expect(result[0]).toMatchObject({ score: null, completedAt: null });
    expect(result[1]).toMatchObject({ score: 76, completedAt: session.server_now });
    expect(result[2]).toMatchObject({ score: 0, completedAt: session.deadline_at });
    expect(database.rpc).toHaveBeenCalledExactlyOnceWith("mock_exam_history", { p_user_id: user });
    expect(database.from).not.toHaveBeenCalled();
    expect(getPaidAccess).toHaveBeenCalledExactlyOnceWith(user, database.client);
    expect(loadPaidExplanations).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/correct_label|selected_label|explanation|options|private|user_id/);
  });
  it("returns empty history without per-attempt reads", async () => {
    const database = db({ history: [] });
    await expect(mockHistory(database.client, user)).resolves.toEqual([]);
    expect(database.rpc).toHaveBeenCalledOnce(); expect(database.from).not.toHaveBeenCalled();
  });
  it("denies access revoked inside the bulk transaction after the preflight", async () => {
    const database = db({ rpcError: { code: "42501" } });
    await expect(mockHistory(database.client, user)).rejects.toMatchObject({ status: 403 });
    expect(getPaidAccess).toHaveBeenCalledOnce(); expect(database.rpc).toHaveBeenCalledOnce();
    expect(database.from).not.toHaveBeenCalled();
  });
  it.each([
    [{ ...session, user_id: itemId, score: null }],
    [{ ...session, score: 2 }],
    [{ ...session, completed_at: session.server_now, score: null }],
    [{ ...session, completed_at: session.server_now, score: 101 }],
    [{ ...session, completed_at: session.server_now, score: 1.5 }],
    [{ ...session, score: null }, { ...session, score: null }],
    Array.from({ length: 51 }, () => ({ ...session, score: null })),
    [null],
  ])("fails closed for foreign or malformed bulk history %#", async (...history) => {
    await expect(mockHistory(db({ history }).client, user)).rejects.toMatchObject({ status: 503 });
  });
  it("maps a failed bulk lookup to unavailable", async () => {
    await expect(mockHistory(db({ rpcError: { code: "XX000" } }).client, user)).rejects.toMatchObject({ status: 503 });
  });
  it("rejects ambiguous canonical option text before invoking the snapshot writer", async () => {
    const ambiguous = bank().map(row => ({ ...row, answers: row.answers.map(answer => ({ ...answer, choice_text: "Duplicate text" })) }));
    const database = db({ bank: ambiguous });
    await expect(createMock(database.client, user)).rejects.toMatchObject({ status: 503 });
    expect(database.rpc).not.toHaveBeenCalled();
  });
  it("creates 50 persisted shuffled answer snapshots with fresh history and no client deadline", async () => {
    const database = db(); expect(await createMock(database.client, user)).toBe(id);
    const [name, args] = database.rpc.mock.calls[0]; expect(name).toBe("create_mock_exam");
    const snapshots = args.p_items as { options: { label: string; text: string }[]; correct_label: string }[];
    expect(snapshots).toHaveLength(50); expect(args).not.toHaveProperty("p_deadline_at");
    expect(snapshots.every(row => row.options.find(option => option.label === row.correct_label)?.text === "Correct")).toBe(true);
    expect(loadAnswerHistory).toHaveBeenCalledWith(database.client, user);
  });
});


describe("withdrawn mock snapshots", () => {
  it("removes withdrawn saved questions and choices from in-progress reads", async () => {
    const items = rows(); items[0].questions.review_status = "QUARANTINED"; items[0].selected_label = "B";
    const result = await readMock(db({ rows: items }).client, id, user);
    expect(result).toMatchObject({ totalQuestions: 49, withdrawnCount: 1, answeredCount: 0 }); expect(result.questions).toHaveLength(49);
    expect(JSON.stringify(result)).not.toContain('"Question 0"');
  });
  it("excludes withdrawn items rather than marking them wrong or revealing their keys", async () => {
    const items = rows().map(row => ({ ...row, is_correct: true, selected_label: "A" }));
    items[0].questions.status = "RETIRED"; items[0].is_correct = false;
    const result = await mockResults(db({ rows: items, session: { completed_at: session.server_now } }).client, id, user);
    expect(result).toMatchObject({ totalQuestions: 49, correctAnswers: 49, score: 100, withdrawnCount: 1 });
    expect(result.review).toHaveLength(49); expect(JSON.stringify(result)).not.toContain('"Question 0"');
    expect(vi.mocked(loadPaidExplanations).mock.calls[0][1]).toHaveLength(49);
  });
});


it("fences mock answer keys after withdrawal during explanation loading", async () => {
  const items = rows().map(row => ({ ...row, is_correct: true, selected_label: "A" }));
  vi.mocked(loadPaidExplanations).mockImplementationOnce(async () => { items[0].questions = { status: "RETIRED", review_status: "GOOD" }; return new Map(); });
  const result = await mockResults(db({ rows: items, session: { completed_at: session.server_now } }).client, id, user);
  expect(result).toMatchObject({ score: 100, totalQuestions: 49, withdrawnCount: 1 }); expect(JSON.stringify(result)).not.toContain('"Question 0"');
});


it("fences learner mock content after withdrawal during the final paid lookup", async () => {
  const items = rows();
  vi.mocked(getPaidAccess).mockResolvedValueOnce(paid).mockImplementationOnce(async () => { items[0].questions = { status: "DRAFT", review_status: "QUARANTINED" }; return paid; });
  const result = await readMock(db({ rows: items }).client, id, user);
  expect(result).toMatchObject({ totalQuestions: 49, withdrawnCount: 1 }); expect(JSON.stringify(result)).not.toContain('"Question 0"');
});
