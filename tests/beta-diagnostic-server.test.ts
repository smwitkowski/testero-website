import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BETA_DIAGNOSTIC_CERT_IDS, betaDiagnosticEnabled, betaDiagnosticMetadata, isBetaDiagnosticCertId } from "@/lib/diagnostic/beta";
import { calculateBetaDomainTargets, selectBetaQuestionsByGuide } from "@/lib/diagnostic/beta-selection";
import { resultsEmailPlan, resultsEmailHtml, resultsEmailText, sendResultsEmail } from "@/lib/diagnostic/results-email";
import { getExamReadinessTier } from "@/lib/readiness";

function inventory(data: unknown[] = [], count: number | null = 20, error: unknown = null) {
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query), order: vi.fn(() => query),
    range: vi.fn(async () => ({ data, error })),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ count, error }).then(resolve),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, query, from };
}
afterEach(() => vi.unstubAllEnvs());
describe("beta eligibility", () => {
  it.each(BETA_DIAGNOSTIC_CERT_IDS)("enables exactly 20 approved live originals for allowlisted %s", async certId => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", ` other, ${certId}, `);
    const db = inventory();
    expect(isBetaDiagnosticCertId(certId)).toBe(true);
    expect(await betaDiagnosticEnabled(db.client, certId)).toBe(true);
    expect(db.query.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(db.query.eq.mock.calls).toEqual([["exam", certId], ["status", "ACTIVE"], ["review_status", "GOOD"], ["question_type", "single_select"]]);
    expect(db.query.is).toHaveBeenCalledWith("parent_question_id", null);
  });
  it.each([0, 19, null])("keeps a configured exam closed at count %s", async count => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", "data-engineer");
    expect(await betaDiagnosticEnabled(inventory([], count).client, "data-engineer")).toBe(false);
  });
  it.each([undefined, "", "cloud-engineer", "data-engineer-extra", "*"])("requires an exact allowlist entry: %s", async config => {
    if (config === undefined) vi.stubEnv("BETA_DIAGNOSTIC_CERTS", undefined); else vi.stubEnv("BETA_DIAGNOSTIC_CERTS", config);
    const db = inventory();
    expect(await betaDiagnosticEnabled(db.client, "data-engineer")).toBe(false);
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each(["machine-learning-engineer", "GCP_PM_ML_ENG", "unknown", "cloud-developer"])("never opens non-beta cert %s even when configured", async certId => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", certId);
    const db = inventory(); expect(isBetaDiagnosticCertId(certId)).toBe(false);
    expect(await betaDiagnosticEnabled(db.client, certId)).toBe(false); expect(db.from).not.toHaveBeenCalled();
  });
  it("fails closed on count errors and transport failures", async () => {
    vi.stubEnv("BETA_DIAGNOSTIC_CERTS", "data-engineer");
    expect(await betaDiagnosticEnabled(inventory([], 100, { message: "private" }).client, "data-engineer")).toBe(false);
    expect(await betaDiagnosticEnabled({ from: () => { throw new Error("private"); } } as unknown as SupabaseClient, "data-engineer")).toBe(false);
  });
});

describe("beta guide-weighted sampling", () => {
  it.each(BETA_DIAGNOSTIC_CERT_IDS)("loads first guide sections and weights for %s", certId => {
    const metadata = betaDiagnosticMetadata(certId);
    expect(metadata.name).toBeTruthy(); expect(metadata.sections.length).toBeGreaterThan(0);
    expect(metadata.sections.reduce((sum, section) => sum + section.weight_percent!, 0)).toBe(100);
    expect(metadata.sections.every(section => section.id.startsWith(`${certId}:`))).toBe(true);
  });
  it("uses largest remainder weights, not PMLE domains", () => {
    const sections = betaDiagnosticMetadata("data-engineer").sections;
    const targets = calculateBetaDomainTargets(10, sections, new Map(sections.map(section => [section.id, 20])));
    expect([...targets.values()]).toEqual([2, 3, 2, 1, 2]);
  });
  it("redistributes all missing stock while honoring caps", () => {
    const sections = [{ id: "a", weight_percent: 90 }, { id: "b", weight_percent: 10 }];
    expect([...calculateBetaDomainTargets(10, sections, new Map([["a", 0], ["b", 20]])).values()]).toEqual([0, 10]);
    expect([...calculateBetaDomainTargets(10, sections, new Map([["a", 1], ["b", 2]])).values()]).toEqual([1, 2]);
    expect(() => calculateBetaDomainTargets(-1, sections, new Map())).toThrow();
  });
  const answerKey = [{ choice_label: "A", choice_text: "Yes", is_correct: true }, { choice_label: "B", choice_text: "No", is_correct: false }];
  function row(id: string, code: string) { return { id, stem: "A usable stem", domain_id: "domain", difficulty: null, exam_domains: { code, name: "A guide section" }, answers: answerKey }; }
  it.each([5, 10])("samples %i unique valid questions using exam-scoped approved originals only", async count => {
    const sections = betaDiagnosticMetadata("data-engineer").sections;
    const rows = sections.flatMap(section => Array.from({ length: 10 }, (_, index) => row(`${section.id}-${index}`, section.id)));
    rows.push({ ...row("invalid", sections[0].id), answers: [] });
    rows.push(row("wrong guide", "GCP_PM_ML_ENG:1"));
    const db = inventory(rows);
    const result = await selectBetaQuestionsByGuide(db.client, "data-engineer", count);
    expect(result.questions).toHaveLength(count); expect(new Set(result.questions.map(question => question.id)).size).toBe(count);
    expect(result.questions.every(question => question.domain_code.startsWith("data-engineer:standard:"))).toBe(true);
    expect(result.questions.some(question => question.id === "invalid")).toBe(false);
    expect(db.query.eq.mock.calls).toEqual([["exam", "data-engineer"], ["status", "ACTIVE"], ["review_status", "GOOD"], ["question_type", "single_select"]]);
    expect(db.query.is).toHaveBeenCalledWith("parent_question_id", null);
  });
  it("fails rather than filling inventory gaps from other exams", async () => {
    await expect(selectBetaQuestionsByGuide(inventory([row("wrong", "OTHER")]).client, "data-engineer", 5)).rejects.toThrow("Insufficient");
    await expect(selectBetaQuestionsByGuide(inventory([], null, { message: "private" }).client, "data-engineer", 5)).rejects.toThrow("unavailable");
  });
  it("paginates inventory instead of silently applying the database row limit", async () => {
    const code = betaDiagnosticMetadata("cloud-engineer").sections[0].id;
    const db = inventory();
    db.query.range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, index) => row(`q-${index}`, code)), error: null }).mockResolvedValueOnce({ data: [row("last", code)], error: null });
    expect((await selectBetaQuestionsByGuide(db.client, "cloud-engineer", 5)).questions).toHaveLength(5);
    expect(db.query.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });
});

describe("PMLE-only results email security", () => {
  const result = { sessionId: "session", certId: "data-engineer", score: 60, correctAnswers: 3, totalQuestions: 5, readiness: getExamReadinessTier(60), domainBreakdown: [] };
  it.each([resultsEmailPlan, resultsEmailText, resultsEmailHtml])("rejects beta rendering before PMLE commerce or study plans", render => {
    expect(() => render(result)).toThrow("not available");
  });
  it("rejects beta before config, RPC, or provider access", async () => {
    const rpc = vi.fn(); const from = vi.fn(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    try {
      await expect(sendResultsEmail({ rpc, from } as unknown as SupabaseClient, "reader@example.com", result)).rejects.toMatchObject({ status: 404 });
      expect(rpc).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
