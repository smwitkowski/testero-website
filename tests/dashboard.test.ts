import { getPaidAccess } from "@/lib/billing/paid-access";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDashboard } from "@/lib/dashboard/service";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: vi.fn() }));
const freeAccess = { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null };
beforeEach(() => { vi.mocked(getPaidAccess).mockReset().mockResolvedValue(freeAccess); });

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = Date.parse("2026-10-03T12:00:00Z");
const rows = ["F", "E", "D", "C", "B", "A"].map(domain => ({ domain_code: domain, domain_name: `Domain ${domain}`, is_correct: !["B", "C"].includes(domain), answered_at: "done", explanation: "secret", options: [{ text: "secret" }], correct_label: "secret", selected_label: "secret" }));
interface Options { latest?: unknown; pending?: unknown; items?: unknown; history?: unknown; errorStage?: "latest" | "pending" | "items" | "history" }
function db(options: Options = {}) {
  const calls: { table: string; selected: string; filters: [string, unknown][]; order: [string, unknown][]; limits: number[] }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, selected: "", filters: [] as [string, unknown][], order: [] as [string, unknown][], limits: [] as number[] }; calls.push(call);
    const result = () => {
      const isPending = call.filters.some(([key, value]) => key === "kind" && value === "practice");
      const stage = table === "study_sessions" ? isPending ? "pending" : "latest" : call.selected.includes("study_sessions!inner") ? "history" : "items";
      const data = stage === "latest" ? options.latest ?? null : stage === "pending" ? options.pending ?? null : stage === "items" ? options.items === undefined ? rows : options.items : options.history ?? [];
      return { data, error: options.errorStage === stage ? { message: "secret DB details" } : null };
    };
    const query = {
      select: vi.fn((fields: string) => { call.selected = fields; return query; }),
      eq: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
      in: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
      range: vi.fn(() => query),
      not: vi.fn((key: string, operation: string, value: unknown) => { call.filters.push([`not:${key}:${operation}`, value]); return query; }),
      is: vi.fn((key: string, value: unknown) => { call.filters.push([`is:${key}`, value]); return query; }),
      gt: vi.fn((key: string, value: unknown) => { call.filters.push([`gt:${key}`, value]); return query; }),
      order: vi.fn((key: string, value?: unknown) => { call.order.push([key, value]); return query; }),
      limit: vi.fn((value: number) => { call.limits.push(value); return query; }),
      maybeSingle: vi.fn(async () => result()), then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, from, calls };
}

describe("owned dashboard aggregates", () => {
  it("supports an empty account without reading question rows", async () => {
    const database = db(); const result = await loadDashboard(database.client, userId, now);
    expect(result).toEqual({ diagnostic: null, weakestDomains: [], domains: PMLE_BLUEPRINT.map(domain => ({ domainCode: domain.domainCode, domainName: domain.displayName })), openPractice: null, paidAccess: freeAccess, progress: { totalQuestions: 0, correctAnswers: 0, score: 0, domainBreakdown: [] }, practiceHistory: [] });
    expect(database.calls.filter(call => call.table === "session_items")).toHaveLength(1);
    expect(database.calls.find(call => call.table === "session_items")?.selected).toContain("study_sessions!inner");
  });
  it("queries only the verified user's latest completed diagnostic and valid open practice", async () => {
    const database = db({ latest: { id: sessionId, question_count: 6 }, pending: { id: "practice-id", domain_codes: [PMLE_BLUEPRINT[0].domainCode] } });
    const result = await loadDashboard(database.client, userId, now);
    expect(result.diagnostic).toMatchObject({ sessionId, score: 67, correctAnswers: 4, totalQuestions: 6 });
    expect(result.weakestDomains.map(domain => domain.domainCode)).toEqual(["C", "B"]); // Ties keep scoring order: exam-guide order, unknown codes as stored.
    expect(result.openPractice).toEqual({ sessionId: "practice-id", domainName: PMLE_BLUEPRINT[0].displayName });
    const sessions = database.calls.filter(call => call.table === "study_sessions");
    expect(sessions).toHaveLength(2);
    for (const call of sessions) expect(call.filters).toContainEqual(["user_id", userId]);
    expect(sessions[0].filters).toContainEqual(["exam", "GCP_PM_ML_ENG"]); // Beta diagnostics never replace the PMLE dashboard's report.
    expect(sessions[0].filters).toContainEqual(["kind", "diagnostic"]); expect(sessions[0].filters).toContainEqual(["not:completed_at:is", null]);
    expect(sessions[0].order).toEqual([["completed_at", { ascending: false }], ["id", undefined]]); expect(sessions[0].limits).toEqual([1]);
    expect(sessions[1].filters).toContainEqual(["kind", "practice"]); expect(sessions[1].filters).toContainEqual(["is:completed_at", null]); expect(sessions[1].filters).toContainEqual(["gt:expires_at", "2026-10-03T12:00:00.000Z"]);
    expect(database.calls.find(call => call.table === "session_items")?.filters).toEqual([["session_id", sessionId]]);
    expect(database.from.mock.calls.map(([table]) => table)).not.toContain("free_practice_quota");
    expect(JSON.stringify(result)).not.toMatch(/review|explanation|options|correct_label|selected_label|secret/);
  });
  it("breaks weakest-domain percentage ties by domain code independently of row order", async () => {
    const items = [...rows].reverse().map(row => ({ ...row, is_correct: false }));
    const result = await loadDashboard(db({ latest: { id: sessionId, question_count: 6 }, items }).client, userId, now);
    expect(result.weakestDomains.map(domain => domain.domainCode)).toEqual(["A", "B"]);
  });
  it("does not read incomplete diagnostic detail fields; access is read fresh", async () => {
    const database = db({ latest: { id: sessionId, question_count: 6 } }); await loadDashboard(database.client, userId, now);
    expect(database.calls.find(call => call.table === "session_items")?.selected).toBe("domain_code,domain_name,is_correct,answered_at");
    expect(database.from.mock.calls.every(([table]) => ["study_sessions", "session_items"].includes(table))).toBe(true);
  });
  it.each([null, [], rows.slice(0, 5), rows.map(row => ({ ...row, answered_at: null })), rows.map(row => ({ ...row, is_correct: null }))])("rejects malformed latest aggregate rows %#", async items => {
    await expect(loadDashboard(db({ latest: { id: sessionId, question_count: 6 }, items }).client, userId, now)).rejects.toMatchObject({ status: 503 });
  });
  it.each(["latest", "pending", "items", "history"] as const)("sanitizes DB failure at %s", async errorStage => {
    await expect(loadDashboard(db({ latest: { id: sessionId, question_count: 6 }, errorStage }).client, userId, now)).rejects.toMatchObject({ status: 503 });
  });
});


describe("free progress tracking", () => {
  it("reads fresh access but never quota for either tier", async () => {
    const paid = { ...freeAccess, hasPaidAccess: true };
    vi.mocked(getPaidAccess).mockResolvedValueOnce(paid).mockResolvedValueOnce({ ...freeAccess, unavailable: true });
    const database = db();
    expect((await loadDashboard(database.client, userId, now)).paidAccess).toEqual(paid);
    expect((await loadDashboard(database.client, userId, now)).paidAccess).toEqual({ ...freeAccess, unavailable: true });
    expect(getPaidAccess).toHaveBeenCalledTimes(2);
    expect(database.from.mock.calls.map(([table]) => table)).not.toContain("free_practice_quota");
  });
  it("aggregates free owned PMLE diagnostic and practice history without selecting private content", async () => {
    const history = rows.map((row,index)=>({...row,session_id:index < 3 ? "practice-one" : "diagnostic-one",study_sessions:{kind:index < 3 ? "practice" : "diagnostic",completed_at:"2026-10-24T12:00:00Z"}}));
    const database=db({history}); const result=await loadDashboard(database.client,userId,now);
    expect(result.progress).toMatchObject({totalQuestions:6,correctAnswers:4,score:67});
    expect(result.progress.domainBreakdown).toHaveLength(6);
    expect(result.practiceHistory).toEqual([{sessionId:"practice-one",completedAt:"2026-10-24T12:00:00Z",totalQuestions:3,correctAnswers:3,score:100}]);
    const call=database.calls.find(call=>call.selected.includes("study_sessions!inner"))!;
    expect(call.filters).toContainEqual(["study_sessions.user_id",userId]);
    expect(call.filters).toContainEqual(["study_sessions.exam","GCP_PM_ML_ENG"]);
    expect(call.filters).toContainEqual(["study_sessions.kind",["diagnostic","practice"]]);
    expect(call.filters).toContainEqual(["not:answered_at:is",null]);
    expect(call.selected).not.toMatch(/stem|options|explanation|correct_label|selected_label/);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("rejects corrupt history instead of publishing inaccurate free scores",async()=>{
    await expect(loadDashboard(db({history:[{...rows[0],is_correct:null}]}).client,userId,now)).rejects.toMatchObject({status:503});
  });
});
