import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDashboard } from "@/lib/dashboard/service";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = Date.parse("2026-10-03T12:00:00Z");
const rows = ["F", "E", "D", "C", "B", "A"].map(domain => ({ domain_code: domain, domain_name: `Domain ${domain}`, is_correct: !["B", "C"].includes(domain), answered_at: "done", explanation: "secret", options: [{ text: "secret" }], correct_label: "secret", selected_label: "secret" }));
interface Options { latest?: unknown; pending?: unknown; items?: unknown; used?: number; errorStage?: "latest" | "pending" | "items" | "quota" }
function db(options: Options = {}) {
  const calls: { table: string; selected: string; filters: [string, unknown][]; order: [string, unknown][]; limits: number[] }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, selected: "", filters: [] as [string, unknown][], order: [] as [string, unknown][], limits: [] as number[] }; calls.push(call);
    const result = () => {
      const isPending = call.filters.some(([key, value]) => key === "kind" && value === "practice");
      const stage = table === "study_sessions" ? isPending ? "pending" : "latest" : table === "session_items" ? "items" : "quota";
      const data = stage === "latest" ? options.latest ?? null : stage === "pending" ? options.pending ?? null : stage === "items" ? options.items === undefined ? rows : options.items : options.used === undefined ? null : { questions_used: options.used };
      return { data, error: options.errorStage === stage ? { message: "secret DB details" } : null };
    };
    const query = {
      select: vi.fn((fields: string) => { call.selected = fields; return query; }),
      eq: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
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
    expect(result).toEqual({ diagnostic: null, weakestDomains: [], domains: PMLE_BLUEPRINT.map(domain => ({ domainCode: domain.domainCode, domainName: domain.displayName })), openPractice: null, quota: { remaining: 5, weekStart: "2026-09-28" } });
    expect(database.from.mock.calls.map(([table]) => table)).not.toContain("session_items");
  });
  it("queries only the verified user's latest completed diagnostic and valid open practice", async () => {
    const database = db({ latest: { id: sessionId, question_count: 6 }, pending: { id: "practice-id", domain_codes: [PMLE_BLUEPRINT[0].domainCode] }, used: 5 });
    const result = await loadDashboard(database.client, userId, now);
    expect(result.diagnostic).toMatchObject({ sessionId, score: 67, correctAnswers: 4, totalQuestions: 6 });
    expect(result.weakestDomains.map(domain => domain.domainCode)).toEqual(["B", "C"]);
    expect(result.openPractice).toEqual({ sessionId: "practice-id", domainName: PMLE_BLUEPRINT[0].displayName }); expect(result.quota.remaining).toBe(0);
    const sessions = database.calls.filter(call => call.table === "study_sessions");
    expect(sessions).toHaveLength(2);
    for (const call of sessions) expect(call.filters).toContainEqual(["user_id", userId]);
    expect(sessions[0].filters).toContainEqual(["kind", "diagnostic"]); expect(sessions[0].filters).toContainEqual(["not:completed_at:is", null]);
    expect(sessions[0].order).toEqual([["completed_at", { ascending: false }], ["id", undefined]]); expect(sessions[0].limits).toEqual([1]);
    expect(sessions[1].filters).toContainEqual(["kind", "practice"]); expect(sessions[1].filters).toContainEqual(["is:completed_at", null]); expect(sessions[1].filters).toContainEqual(["gt:expires_at", "2026-10-03T12:00:00.000Z"]);
    expect(database.calls.find(call => call.table === "session_items")?.filters).toEqual([["session_id", sessionId]]);
    expect(database.calls.find(call => call.table === "free_practice_quota")?.filters).toContainEqual(["user_id", userId]);
    expect(JSON.stringify(result)).not.toMatch(/review|explanation|options|correct_label|selected_label|secret/);
  });
  it("breaks weakest-domain percentage ties by domain code independently of row order", async () => {
    const items = [...rows].reverse().map(row => ({ ...row, is_correct: false }));
    const result = await loadDashboard(db({ latest: { id: sessionId, question_count: 6 }, items }).client, userId, now);
    expect(result.weakestDomains.map(domain => domain.domainCode)).toEqual(["A", "B"]);
  });
  it("does not read incomplete diagnostic detail fields or paid-access state", async () => {
    const database = db({ latest: { id: sessionId, question_count: 6 } }); await loadDashboard(database.client, userId, now);
    expect(database.calls.find(call => call.table === "session_items")?.selected).toBe("domain_code,domain_name,is_correct,answered_at");
    expect(database.from.mock.calls.every(([table]) => ["study_sessions", "session_items", "free_practice_quota"].includes(table))).toBe(true);
  });
  it.each([null, [], rows.slice(0, 5), rows.map(row => ({ ...row, answered_at: null })), rows.map(row => ({ ...row, is_correct: null }))])("rejects malformed latest aggregate rows %#", async items => {
    await expect(loadDashboard(db({ latest: { id: sessionId, question_count: 6 }, items }).client, userId, now)).rejects.toMatchObject({ status: 503 });
  });
  it.each(["latest", "pending", "items", "quota"] as const)("sanitizes DB failure at %s", async errorStage => {
    await expect(loadDashboard(db({ latest: { id: sessionId, question_count: 6 }, errorStage }).client, userId, now)).rejects.toMatchObject({ status: 503 });
  });
});
