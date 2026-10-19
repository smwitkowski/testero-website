import { loadPaidExplanations } from "@/lib/billing/explanations";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPractice, readPractice, answerPractice, practiceSummary, freePracticeQuota, utcMonthStart } from "@/lib/practice/service";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

vi.mock("@/lib/billing/explanations", async original => ({ ...await original<typeof import("@/lib/billing/explanations")>(), loadPaidExplanations: vi.fn() }));
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: vi.fn() }));
const freeAccess = { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null };
beforeEach(() => { vi.mocked(getPaidAccess).mockReset().mockResolvedValue(freeAccess); vi.mocked(loadPaidExplanations).mockReset().mockResolvedValue(new Map()); });

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = Date.parse("2026-10-03T12:00:00Z");
const domain = PMLE_BLUEPRINT[0].domainCode;
const session = { id: sessionId, kind: "practice", user_id: userId, anonymous_owner_hash: null, question_count: 5, completed_at: null, expires_at: "2026-10-04T12:00:00Z" };
function bank() { return Array.from({ length: 6 }, (_, index) => ({ id: `bank-${index}`, parent_question_id: null as string | null, stem: `Question ${index}`, exam_domains: { code: domain, name: "Domain A" }, answers: [{ choice_label: "A", choice_text: "Correct", is_correct: true }, { choice_label: "B", choice_text: "Wrong", is_correct: false }] })); }
function rows() { return Array.from({ length: 5 }, (_, index) => ({ id: index === 0 ? itemId : `item-${index}`, ordinal: index + 1, stem: `Question ${index}`, options: [{ label: "A", text: "Correct", explanation: "secret" }, { label: "B", text: "Wrong" }], selected_label: null as string | null, correct_label: "A", is_correct: null as boolean | null, answered_at: null as string | null, domain_code: domain, domain_name: "Domain A", explanation: "secret", source_url: "secret", question_id: "secret bank" })); }
interface Options { session?: unknown; items?: unknown; bank?: unknown; used?: unknown; errorTable?: string; rpcData?: unknown; rpcError?: { code: string; message: string }; feedback?: unknown; rpc?: () => Promise<{ data: unknown; error: unknown }> }
function db(options: Options = {}) {
  const queries: { table: string; filters: [string, unknown][]; selected: string }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, filters: [] as [string, unknown][], selected: "" }; queries.push(call);
    const result = () => {
      let data: unknown = null;
      if (table === "free_practice_quota") data = options.used === undefined ? null : { questions_used: options.used };
      if (table === "questions") data = options.bank === undefined ? bank() : options.bank;
      if (table === "study_sessions") {
        data = options.session === undefined ? session : options.session;
        if (data && call.filters.some(([key, value]) => key === "kind" && (data as typeof session).kind !== value)) data = null;
      }
      if (table === "session_items") {
        const committed = options.rpcData && !options.rpcError;
        const all = options.items === undefined ? rows().map((row, index) => committed && index === 0 ? options.feedback ?? { ...row, selected_label: "A", is_correct: true, answered_at: "done" } : row) : options.items;
        data = call.filters.some(([key]) => key === "id") ? options.feedback ?? { ...rows()[0], selected_label: "A", is_correct: true, answered_at: "done" } : all;
      }
      return { data, error: options.errorTable === table ? { message: "secret SDK error" } : null };
    };
    const query = {
      select: vi.fn((fields: string) => { call.selected = fields; return query; }),
      eq: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
      is: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
      order: vi.fn(() => query), maybeSingle: vi.fn(async () => result()),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn(options.rpc ?? (async () => ({ data: options.rpcData === undefined ? sessionId : options.rpcData, error: options.rpcError ?? null })));
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, queries };
}

describe("monthly free practice", () => {
  it("reserves exactly five chosen-domain valid shuffled snapshots with the free atomic RPC", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const database = db({ bank: [...bank(), { ...bank()[0], id: "foreign", exam_domains: { code: "foreign", name: "Foreign" } }, { ...bank()[0], id: "invalid", answers: [] }] });
    expect(await createPractice(database.client, userId, domain, now)).toBe(sessionId);
    expect(database.rpc).toHaveBeenCalledOnce();
    const [name, args] = database.rpc.mock.calls[0] as unknown as [string, { p_user_id: string; p_items: { question_id: string; domain_code: string; correct_label: string; options: { label: string; text: string }[] }[]; p_expires_at: string }];
    expect(name).toBe("create_free_practice_session"); expect(args.p_user_id).toBe(userId);
    expect(args.p_items).toHaveLength(5); expect(new Set(args.p_items.map(item => item.question_id)).size).toBe(5);
    expect(args.p_items.every(item => item.domain_code === domain && !["foreign", "invalid"].includes(item.question_id))).toBe(true);
    expect(args.p_items[0].options).toEqual([{ label: "A", text: "Wrong" }, { label: "B", text: "Correct" }]); expect(args.p_items[0].correct_label).toBe("B");
    expect(args.p_expires_at).toBe("2026-10-04T12:00:00.000Z");
    expect(database.queries[1].filters).toContainEqual(["exam_domains.code", domain]);
    expect(database.queries[1].filters).toContainEqual(["exam", "GCP_PM_ML_ENG"]);
    expect(database.queries[1].filters).toContainEqual(["status", "ACTIVE"]);
    expect(database.queries[1].filters).toContainEqual(["review_status", "GOOD"]);
  });
  it("excludes variants in the free bank query and rejects variant rows defensively", async () => {
    const variant = { ...bank()[0], id: "variant", parent_question_id: "bank-0" };
    const database = db({ bank: [...bank(), variant] });
    await createPractice(database.client, userId, domain, now);
    expect(database.queries.find(query => query.table === "questions")?.filters).toContainEqual(["parent_question_id", null]);
    const [, args] = database.rpc.mock.calls[0] as unknown as [string, { p_items: { question_id: string }[] }];
    expect(args.p_items.map(item => item.question_id)).not.toContain("variant");
    const variantsOnly = db({ bank: bank().map(question => ({ ...question, parent_question_id: "parent" })) });
    await expect(createPractice(variantsOnly.client, userId, domain, now)).rejects.toMatchObject({ status: 503 });
    expect(variantsOnly.rpc).not.toHaveBeenCalled();
  });
  it.each([60])("does not query bank or RPC with exhausted quota %s", async used => {
    const database = db({ used }); await expect(createPractice(database.client, userId, domain, now)).rejects.toMatchObject({ status: 429 });
    expect(database.from.mock.calls).toEqual([["free_practice_quota"]]); expect(database.rpc).not.toHaveBeenCalled();
  });
  it.each(["bad", ""])('rejects invalid identity before any DB call %s', async user => {
    const database = db(); await expect(createPractice(database.client, user, domain, now)).rejects.toMatchObject({ status: 401 }); expect(database.from).not.toHaveBeenCalled();
  });
  it("rejects invalid domain before any DB call", async () => { const database = db(); await expect(createPractice(database.client, userId, "foreign", now)).rejects.toMatchObject({ status: 400 }); expect(database.from).not.toHaveBeenCalled(); });
  it.each([[], null, bank().slice(0, 4), Array.from({ length: 5 }, () => bank()[0])])("rejects insufficient/malformed/duplicate bank without reserving quota %#", async questions => {
    const database = db({ bank: questions }); await expect(createPractice(database.client, userId, domain, now)).rejects.toMatchObject({ status: 503 }); expect(database.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, "bad-id"])('fails closed for malformed create RPC response %#', async rpcData => { await expect(createPractice(db({ rpcData }).client, userId, domain, now)).rejects.toMatchObject({ status: 503 }); });
  it("maps atomic quota failure to 429 without generic/paid fallback RPC", async () => {
    const database = db({ rpcError: { code: "P0001", message: "Free practice quota exceeded" } });
    await expect(createPractice(database.client, userId, domain, now)).rejects.toMatchObject({ status: 429 }); expect(database.rpc).toHaveBeenCalledOnce();
    expect(database.from.mock.calls.map(([table]) => table)).not.toContain("pmle_passes");
  });
  it("trusts only atomic reservation under eight concurrent creation attempts", async () => {
    let used = 55;
    const database = db({ rpc: async () => { if (used + 5 > 60) return { data: null, error: { code: "P0001", message: "Free practice quota exceeded" } }; used += 5; return { data: sessionId, error: null }; } });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createPractice(database.client, userId, domain, now)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected").every(result => result.status === "rejected" && result.reason.status === 429)).toBe(true);
    expect(used).toBe(60); expect(database.rpc).toHaveBeenCalledTimes(8);
  });
  it.each([-1, 61, 1.5, "5"])('rejects corrupt quota %s', async used => { await expect(freePracticeQuota(db({ used }).client, userId)).rejects.toMatchObject({ status: 503 }); });
  it.each(["free_practice_quota", "questions"])('sanitizes query failures for %s', async errorTable => { await expect(createPractice(db({ errorTable }).client, userId, domain, now)).rejects.toMatchObject({ status: 503 }); });
  it("uses UTC calendar months including rollover and year boundaries", () => {
    expect(utcMonthStart(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10-01");
    expect(utcMonthStart(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11-01");
    expect(utcMonthStart(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01-01");
  });
  it.each([[55, 5], [56, 4], [59, 1]])("caps session length at remaining questions: used %s", async (used, length) => {
    const database = db({ used });
    await createPractice(database.client, userId, domain, now);
    expect(database.rpc).toHaveBeenCalledWith("create_free_practice_session", expect.objectContaining({ p_items: expect.arrayContaining([expect.any(Object)]) }));
    expect((database.rpc.mock.calls[0] as unknown as [string, { p_items: unknown[] }])[1].p_items).toHaveLength(length);
  });
  it("reads a new quota bucket at month rollover", async () => {
    const database = db();
    const before = await freePracticeQuota(database.client, userId, new Date("2026-10-31T23:59:59Z"));
    const after = await freePracticeQuota(database.client, userId, new Date("2026-11-01T00:00:00Z"));
    expect(before.monthStart).toBe("2026-10-01"); expect(after).toEqual({ remaining: 60, monthStart: "2026-11-01" });
    expect(database.queries[1].filters).toContainEqual(["month_start", "2026-11-01"]);
  });
});

describe("practice ownership and no early correctness", () => {
  it.each(["read", "answer", "summary"])('foreign owner blocks items and RPC: %s', async operation => {
    const database = db({ session: { ...session, user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } });
    const call = operation === "read" ? readPractice(database.client, sessionId, userId, now) : operation === "answer" ? answerPractice(database.client, sessionId, userId, itemId, "A", now) : practiceSummary(database.client, sessionId, userId, now);
    await expect(call).rejects.toMatchObject({ status: 404 }); expect(database.from.mock.calls).toEqual([["study_sessions"]]); expect(database.rpc).not.toHaveBeenCalled();
  });
  it.each(["read", "answer", "summary"])('diagnostic session IDs cannot cross the practice correctness boundary: %s', async operation => {
    const database = db({ session: { ...session, kind: "diagnostic", completed_at: "done" } });
    const call = operation === "read" ? readPractice(database.client, sessionId, userId, now) : operation === "answer" ? answerPractice(database.client, sessionId, userId, itemId, "A", now) : practiceSummary(database.client, sessionId, userId, now);
    await expect(call).rejects.toMatchObject({ status: 404 }); expect(database.queries[0].filters).toContainEqual(["kind", "practice"]); expect(database.from.mock.calls).toEqual([["study_sessions"]]); expect(database.rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed IDs without DB calls", async () => { const database = db(); await expect(readPractice(database.client, "bad", userId, now)).rejects.toMatchObject({ status: 404 }); expect(database.from).not.toHaveBeenCalled(); });
  it("rejects expired unfinished sessions before item reads", async () => { const database = db({ session: { ...session, expires_at: "2026-10-01T00:00:00Z" } }); await expect(readPractice(database.client, sessionId, userId, now)).rejects.toMatchObject({ status: 410 }); expect(database.from.mock.calls).toEqual([["study_sessions"]]); });
  it("whitelists progress and nested options even for malicious extra JSON", async () => {
    const progress = await readPractice(db().client, sessionId, userId, now);
    expect(progress.currentQuestion).toEqual({ id: itemId, ordinal: 1, domainCode: domain, stem: "Question 0", options: [{ label: "A", text: "Correct" }, { label: "B", text: "Wrong" }] });
    expect(JSON.stringify(progress)).not.toMatch(/correctLabel|selectedLabel|isCorrect|correct_label|selected_label|explanation|source|question_id/);
  });
  it("exposes only a variant boolean, not the parent ID, on saved practice progress", async () => {
    const items = rows().map(row => ({ ...row, questions: { parent_question_id: "private-parent-id" } }));
    const database = db({ items });
    const progress = await readPractice(database.client, sessionId, userId, now);
    expect(progress.currentQuestion).toMatchObject({ isVariant: true });
    expect(database.queries[1].selected).toContain("questions(parent_question_id)");
    expect(JSON.stringify(progress)).not.toMatch(/private-parent-id|parent_question_id|questions":/);
  });
  it("infers completed progress when final answer arrives after session read", async () => { const result = await readPractice(db({ items: rows().map(row => ({ ...row, answered_at: "done", is_correct: true })) }).client, sessionId, userId, now); expect(result).toEqual({ sessionId, status: "completed", totalQuestions: 5, answeredCount: 5, currentQuestion: null }); });
  it("blocks incomplete summaries before item reads", async () => { const database = db(); await expect(practiceSummary(database.client, sessionId, userId, now)).rejects.toMatchObject({ status: 409 }); expect(database.from.mock.calls).toEqual([["study_sessions"]]); });
  it("returns completed scoring and review without explanations even after expiry", async () => {
    const result = await practiceSummary(db({ session: { ...session, completed_at: "done", expires_at: "2026-10-01T00:00:00Z" }, items: rows().map((row, index) => ({ ...row, answered_at: "done", selected_label: index === 0 ? "B" : "A", is_correct: index !== 0 })) }).client, sessionId, userId, now);
    expect(result).toMatchObject({ hasPaidTracking: false, totalQuestions: 5 });
    expect(result).not.toHaveProperty("score"); expect(result).not.toHaveProperty("correctAnswers"); expect(result).not.toHaveProperty("domainBreakdown"); expect(result).not.toHaveProperty("readiness"); expect(result.review).toHaveLength(5);
    expect(result.review[0]).toMatchObject({ selectedLabel: "B", correctLabel: "A", isCorrect: false });
    expect(JSON.stringify(result)).not.toMatch(/explanation|source_url|question_id|secret/);
  });
  it("rejects malformed completed summaries", async () => { await expect(practiceSummary(db({ session: { ...session, completed_at: "done" } }).client, sessionId, userId, now)).rejects.toMatchObject({ status: 503 }); });
});

describe("committed answer feedback", () => {
  const progress = { answeredCount: 1, totalQuestions: 5, completed: false, explanation: "secret", correct_label: "secret" };
  it("reads feedback only after RPC commit, passes server owner, and strips extras on retries", async () => {
    const database = db({ rpcData: progress });
    for (let attempt = 0; attempt < 2; attempt++) expect(await answerPractice(database.client, sessionId, userId, itemId, "A", now)).toMatchObject({ answeredCount: 1, totalQuestions: 5, completed: false, progress: { answeredCount: 1, currentQuestion: { ordinal: 2 } }, feedback: { itemId, selectedLabel: "A", correctLabel: "A", isCorrect: true } });
    expect(database.rpc).toHaveBeenCalledWith("answer_study_item", { p_session_id: sessionId, p_item_id: itemId, p_selected_label: "A", p_user_id: userId, p_anonymous_owner_hash: null });
    expect(database.rpc.mock.invocationCallOrder[0]).toBeLessThan(database.from.mock.invocationCallOrder[1]);
  });
  it.each([null, { answeredCount: 0, totalQuestions: 5, completed: false }, { answeredCount: 6, totalQuestions: 5, completed: true }, { answeredCount: 1.5, totalQuestions: 5, completed: false }, { answeredCount: 1, totalQuestions: 20, completed: false }, { answeredCount: 1, totalQuestions: 5, completed: true }, { answeredCount: 5, totalQuestions: 5, completed: false }, { answeredCount: 1, totalQuestions: 5, completed: "false" }])("rejects malformed RPC progress before feedback reads %#", async rpcData => { const database = db({ rpcData }); await expect(answerPractice(database.client, sessionId, userId, itemId, "A", now)).rejects.toMatchObject({ status: 503 }); expect(database.from.mock.calls).toEqual([["study_sessions"]]); });
  it.each([["42501", "Foreign", 404], ["22023", "Session expired", 410], ["22023", "Already answered differently", 409], ["XX000", "secret SDK", 503]])("maps RPC errors safely %s", async (code, message, status) => { const database = db({ rpcError: { code: String(code), message: String(message) } }); await expect(answerPractice(database.client, sessionId, userId, itemId, "A", now)).rejects.toMatchObject({ status }); expect(database.from.mock.calls).toEqual([["study_sessions"]]); });
  it("does not return feedback whose committed selected label differs", async () => { await expect(answerPractice(db({ rpcData: progress, feedback: { ...rows()[0], selected_label: "B", is_correct: false, answered_at: "done" } }).client, sessionId, userId, itemId, "A", now)).rejects.toMatchObject({ status: 503 }); });
});


describe("malformed committed feedback and review fail closed", () => {
  it.each([{ correct_label: undefined }, { correct_label: "ZZ" }, { id: "different-item" }, { is_correct: false }, { options: [] }, { options: [{ label: "A", text: "One" }, { label: "A", text: "Two" }] }])("rejects malformed feedback row %#", async override => {
    const feedback = { ...rows()[0], selected_label: "A", correct_label: "A", is_correct: true, answered_at: "done", ...override };
    await expect(answerPractice(db({ rpcData: { answeredCount: 1, totalQuestions: 5, completed: false }, feedback }).client, sessionId, userId, itemId, "A", now)).rejects.toMatchObject({ status: 503 });
  });
  it.each([{ correct_label: undefined }, { correct_label: "Z" }, { selected_label: "Z" }, { is_correct: false }, { options: [{ label: "A", text: 123 }] }])("rejects malformed completed review labels %#", async override => {
    const items = rows().map(row => ({ ...row, selected_label: "A", is_correct: true, answered_at: "done", ...override }));
    await expect(practiceSummary(db({ session: { ...session, completed_at: "done" }, items }).client, sessionId, userId, now)).rejects.toMatchObject({ status: 503 });
  });
});


it("returns safe progress from the same newer snapshot as its outer counts", async () => {
  const committed = rows().map((row, index) => index < 2 ? { ...row, selected_label: "A", is_correct: true, answered_at: "done" } : row);
  const database = db({ items: committed, rpcData: { answeredCount: 1, totalQuestions: 5, completed: false } });
  const answer = await answerPractice(database.client, sessionId, userId, itemId, "A", now);
  expect(answer).toMatchObject({ answeredCount: 2, completed: false, feedback: { itemId }, progress: { answeredCount: 2, currentQuestion: { ordinal: 3 } } });
  expect(Object.keys(answer.progress.currentQuestion!).sort()).toEqual(["id", "ordinal", "domainCode", "stem", "options"].sort());
  expect(answer.progress.currentQuestion!.options).toEqual([{ label: "A", text: "Correct" }, { label: "B", text: "Wrong" }]);
  expect(JSON.stringify(answer.progress)).not.toMatch(/correct_label|is_correct|explanation|question_id|selected_label/);
});
it("rejects practice progress behind the committed RPC count", async () => {
  const committed = rows(); committed[0] = { ...committed[0], selected_label: "A", is_correct: true, answered_at: "done" };
  const database = db({ items: committed, rpcData: { answeredCount: 2, totalQuestions: 5, completed: false } });
  await expect(answerPractice(database.client, sessionId, userId, itemId, "A", now)).rejects.toMatchObject({ status: 503 });
});

describe("paid practice uses fresh access, never charges the free counter", () => {
  const paid = { ...freeAccess, hasPaidAccess: true };
  const content = { explanation: "Question reason", optionExplanations: [{ label: "A", text: "Correct", explanation: "Correct reason" }, { label: "B", text: "Wrong", explanation: "Wrong reason" }] };
  it("allows repeated five-question paid sessions with no quota read", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue(paid);
    const database = db({ used: 60 });
    for (let index = 0; index < 3; index++) expect(await createPractice(database.client, userId, domain, now)).toBe(sessionId);
    expect(database.from.mock.calls).toEqual([["questions"], ["questions"], ["questions"]]);
    expect(database.rpc).toHaveBeenCalledTimes(3);
    expect(getPaidAccess).toHaveBeenCalledTimes(3);
    expect(database.rpc.mock.calls[0]).toEqual(["create_study_session", expect.objectContaining({ p_kind: "practice", p_user_id: userId, p_anonymous_owner_hash: null, p_items: expect.any(Array) })]);
    const args = database.rpc.mock.calls[0] as unknown as [string, { p_items: unknown[] }]; expect(args[1].p_items).toHaveLength(5);
  });
  it("allows paid variants but never selects their parent or a sibling in the same session", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue(paid);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const parent = bank()[0];
    const candidates = [parent, { ...parent, id: "variant", parent_question_id: parent.id }, { ...parent, id: "sibling", parent_question_id: parent.id }, ...bank().slice(1, 5)];
    const database = db({ bank: candidates });
    await createPractice(database.client, userId, domain, now);
    expect(database.queries[0].filters).not.toContainEqual(["parent_question_id", null]);
    const [, args] = database.rpc.mock.calls[0] as unknown as [string, { p_items: { question_id: string }[] }];
    const selected = args.p_items.map(item => candidates.find(candidate => candidate.id === item.question_id)!);
    expect(selected).toHaveLength(5);
    expect(selected.some(question => question.parent_question_id !== null)).toBe(true);
    expect(new Set(selected.map(question => question.parent_question_id ?? question.id)).size).toBe(5);
  });
  it("fails closed when a variant itself has a variant in the paid pool", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue(paid);
    const root = bank()[0];
    const parent = { ...root, id: "nested-parent", parent_question_id: root.id };
    const nested = { ...root, id: "nested-child", parent_question_id: parent.id };
    const database = db({ bank: [...bank(), parent, nested] });
    await expect(createPractice(database.client, userId, domain, now)).rejects.toMatchObject({ status: 503 });
    expect(database.rpc).not.toHaveBeenCalled();
  });
  it("fails closed without charging quota when paid inventory has too few distinct families", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue(paid);
    const database = db({ bank: bank().map(question => ({ ...question, parent_question_id: "one-parent" })) });
    await expect(createPractice(database.client, userId, domain, now)).rejects.toMatchObject({ status: 503 });
    expect(database.rpc).not.toHaveBeenCalled();
    expect(database.from.mock.calls).toEqual([["questions"]]);
  });
  it("does not fall back to free RPC after a paid DB recheck rejects access", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue(paid);
    const database = db({ rpcError: { code: "42501", message: "Paid practice access required" } });
    await expect(createPractice(database.client, userId, domain, now)).rejects.toMatchObject({ status: 503 });
    expect(database.rpc).toHaveBeenCalledOnce(); expect(database.rpc.mock.calls[0]).toEqual(["create_study_session", expect.any(Object)]);
  });
  it("access failure takes strict free path without paid fallback", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue({ ...freeAccess, unavailable: true });
    const database = db({ used: 60 }); await expect(createPractice(database.client, userId, domain, now)).rejects.toMatchObject({ status: 429 }); expect(database.rpc).not.toHaveBeenCalled();
  });
  it("still redacts all progress before an answer, even if paid", async () => {
    vi.mocked(getPaidAccess).mockResolvedValue(paid);
    const result = await readPractice(db().client, sessionId, userId, now);
    expect(JSON.stringify(result)).not.toMatch(/correctLabel|explanation|question_id/);
    expect(getPaidAccess).not.toHaveBeenCalled(); expect(loadPaidExplanations).not.toHaveBeenCalled();
  });
  it("rechecks paid access only after committed feedback, redacting refund/expiry/error on retries", async () => {
    vi.mocked(getPaidAccess).mockResolvedValueOnce(paid).mockResolvedValueOnce(freeAccess).mockResolvedValueOnce({ ...freeAccess, unavailable: true });
    vi.mocked(loadPaidExplanations).mockResolvedValue(new Map([[itemId, content]]));
    const database = db({ rpcData: { answeredCount: 1, totalQuestions: 5, completed: false } });
    expect((await answerPractice(database.client, sessionId, userId, itemId, "A", now)).feedback).toMatchObject(content);
    expect(getPaidAccess).toHaveBeenCalledWith(userId, database.client, now);
    expect(database.from.mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(getPaidAccess).mock.invocationCallOrder[0]);
    for (let index = 0; index < 2; index++) expect((await answerPractice(database.client, sessionId, userId, itemId, "A", now)).feedback).toEqual({ itemId, selectedLabel: "A", correctLabel: "A", isCorrect: true });
    expect(loadPaidExplanations).toHaveBeenCalledOnce();
  });
  it("fresh completed review attaches safe per-option explanations then redacts after access loss", async () => {
    vi.mocked(getPaidAccess).mockResolvedValueOnce(paid).mockResolvedValueOnce(freeAccess);
    vi.mocked(loadPaidExplanations).mockResolvedValue(new Map([[itemId, content]]));
    const database = db({ session: { ...session, completed_at: "done" }, items: rows().map(row => ({ ...row, selected_label: "A", is_correct: true, answered_at: "done" })) });
    const result = await practiceSummary(database.client, sessionId, userId, now);
    expect(result).toMatchObject({ hasPaidTracking: true, score: 100, correctAnswers: 5 });
    expect(result).toHaveProperty("domainBreakdown");
    expect(result.review[0].explanation).toBe(content.explanation); expect(result.review[0].options[0].explanation).toBe("Correct reason");
    expect(JSON.stringify(result)).not.toMatch(/question_id|source_url|secret/);
    expect(JSON.stringify(await practiceSummary(database.client, sessionId, userId, now))).not.toMatch(/explanation|reason/);
    expect(loadPaidExplanations).toHaveBeenCalledOnce();
  });
});
