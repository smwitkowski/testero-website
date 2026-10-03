import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPractice, readPractice, answerPractice, practiceSummary, freePracticeQuota, utcWeekStart } from "@/lib/practice/service";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = Date.parse("2026-10-03T12:00:00Z");
const domain = PMLE_BLUEPRINT[0].domainCode;
const session = { id: sessionId, kind: "practice", user_id: userId, anonymous_owner_hash: null, question_count: 5, completed_at: null, expires_at: "2026-10-04T12:00:00Z" };
function bank() { return Array.from({ length: 6 }, (_, index) => ({ id: `bank-${index}`, stem: `Question ${index}`, exam_domains: { code: domain, name: "Domain A" }, answers: [{ choice_label: "A", choice_text: "Correct", is_correct: true }, { choice_label: "B", choice_text: "Wrong", is_correct: false }] })); }
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
      if (table === "session_items") data = call.filters.some(([key]) => key === "id") ? options.feedback ?? { ...rows()[0], selected_label: "A", is_correct: true, answered_at: "done" } : options.items === undefined ? rows() : options.items;
      return { data, error: options.errorTable === table ? { message: "secret SDK error" } : null };
    };
    const query = {
      select: vi.fn((fields: string) => { call.selected = fields; return query; }),
      eq: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
      order: vi.fn(() => query), maybeSingle: vi.fn(async () => result()),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn(options.rpc ?? (async () => ({ data: options.rpcData === undefined ? sessionId : options.rpcData, error: options.rpcError ?? null })));
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, queries };
}

describe("strict five-question free practice", () => {
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
  it.each([1, 4, 5])("does not query bank or RPC with partially/full consumed quota %s", async used => {
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
    let used = 0;
    const database = db({ rpc: async () => { if (used + 5 > 5) return { data: null, error: { code: "P0001", message: "Free practice quota exceeded" } }; used += 5; return { data: sessionId, error: null }; } });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createPractice(database.client, userId, domain, now)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected").every(result => result.status === "rejected" && result.reason.status === 429)).toBe(true);
    expect(used).toBe(5); expect(database.rpc).toHaveBeenCalledTimes(8);
  });
  it.each([-1, 6, 1.5, "5"])('rejects corrupt quota %s', async used => { await expect(freePracticeQuota(db({ used }).client, userId)).rejects.toMatchObject({ status: 503 }); });
  it.each(["free_practice_quota", "questions"])('sanitizes query failures for %s', async errorTable => { await expect(createPractice(db({ errorTable }).client, userId, domain, now)).rejects.toMatchObject({ status: 503 }); });
  it("uses UTC Monday weeks including Sunday and year boundaries", () => {
    expect(utcWeekStart(new Date("2026-10-04T23:59:59Z"))).toBe("2026-09-28");
    expect(utcWeekStart(new Date("2026-10-05T00:00:00Z"))).toBe("2026-10-05");
    expect(utcWeekStart(new Date("2027-01-01T00:00:00Z"))).toBe("2026-12-28");
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
    expect(progress.currentQuestion).toEqual({ id: itemId, ordinal: 1, stem: "Question 0", options: [{ label: "A", text: "Correct" }, { label: "B", text: "Wrong" }] });
    expect(JSON.stringify(progress)).not.toMatch(/correctLabel|selectedLabel|isCorrect|correct_label|selected_label|explanation|source|question_id/);
  });
  it("infers completed progress when final answer arrives after session read", async () => { const result = await readPractice(db({ items: rows().map(row => ({ ...row, answered_at: "done", is_correct: true })) }).client, sessionId, userId, now); expect(result).toEqual({ sessionId, status: "completed", totalQuestions: 5, answeredCount: 5, currentQuestion: null }); });
  it("blocks incomplete summaries before item reads", async () => { const database = db(); await expect(practiceSummary(database.client, sessionId, userId, now)).rejects.toMatchObject({ status: 409 }); expect(database.from.mock.calls).toEqual([["study_sessions"]]); });
  it("returns completed scoring and review without explanations even after expiry", async () => {
    const result = await practiceSummary(db({ session: { ...session, completed_at: "done", expires_at: "2026-10-01T00:00:00Z" }, items: rows().map((row, index) => ({ ...row, answered_at: "done", selected_label: index === 0 ? "B" : "A", is_correct: index !== 0 })) }).client, sessionId, userId, now);
    expect(result).toMatchObject({ score: 80, correctAnswers: 4, totalQuestions: 5 }); expect(result.review).toHaveLength(5);
    expect(result.review[0]).toMatchObject({ selectedLabel: "B", correctLabel: "A", isCorrect: false });
    expect(JSON.stringify(result)).not.toMatch(/explanation|source_url|question_id|secret/);
  });
  it("rejects malformed completed summaries", async () => { await expect(practiceSummary(db({ session: { ...session, completed_at: "done" } }).client, sessionId, userId, now)).rejects.toMatchObject({ status: 503 }); });
});

describe("committed answer feedback", () => {
  const progress = { answeredCount: 1, totalQuestions: 5, completed: false, explanation: "secret", correct_label: "secret" };
  it("reads feedback only after RPC commit, passes server owner, and strips extras on retries", async () => {
    const database = db({ rpcData: progress });
    for (let attempt = 0; attempt < 2; attempt++) expect(await answerPractice(database.client, sessionId, userId, itemId, "A", now)).toEqual({ answeredCount: 1, totalQuestions: 5, completed: false, feedback: { itemId, selectedLabel: "A", correctLabel: "A", isCorrect: true } });
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
