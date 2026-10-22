import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import freeSet from "@/lib/chatgpt/free-set.json";
import { getCertification } from "@/lib/certifications/data";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

const syntheticSource = {
  kind: "local-export", upstream: "read-only-database-content-export",
  exported_at: "2026-10-22T00:00:00.000Z", export_sha256: "a".repeat(64), selection: "synthetic-test",
};

const extraId = "11111111-1111-4111-8111-111111111111";
let exams: typeof import("@/lib/chatgpt/exams");
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("CHATGPT_EXAMS", undefined);
  exams = await import("@/lib/chatgpt/exams");
});
afterEach(() => {
  vi.unstubAllEnvs(); vi.restoreAllMocks();
  vi.doUnmock("@/lib/chatgpt/free-set.json");
  vi.doUnmock("@/lib/chatgpt/free-sets.json");
  vi.doUnmock("@/lib/certifications/data");
});
async function extraSets(value: unknown) {
  vi.doMock("@/lib/chatgpt/free-sets.json", () => ({ default: value }));
  vi.resetModules();
  exams = await import("@/lib/chatgpt/exams");
}
async function certMock(value: unknown) {
  vi.doMock("@/lib/certifications/data", () => ({ getCertification: () => value }));
  vi.resetModules();
  exams = await import("@/lib/chatgpt/exams");
}

describe("ChatGPT enabled exam configuration", () => {
  it("defaults to the legacy PMLE exam with exactly the checked-in 40 IDs and guide domains", () => {
    expect(exams.DEFAULT_CHATGPT_EXAM).toBe("GCP_PM_ML_ENG");
    const enabled = exams.getChatgptExams();
    expect(enabled).toHaveLength(1);
    expect(enabled[0]).toMatchObject({ id: "GCP_PM_ML_ENG", certId: "machine-learning-engineer", questionIds: freeSet.question_ids });
    expect(enabled[0].questionIds).toHaveLength(40);
    expect(enabled[0].domains).toEqual(PMLE_BLUEPRINT);
    expect(enabled[0].weightNote).toBe("Official approximate weights total 101%; sampling weights are normalized to sum to one.");
    expect(exams.getChatgptExam("machine-learning-engineer")).toBeUndefined();
    expect(exams.getChatgptExam("data-engineer")).toBeUndefined();
    expect(Object.isFrozen(enabled)).toBe(true);
    expect(Object.isFrozen(enabled[0].questionIds)).toBe(true);
    expect(Object.isFrozen(enabled[0].domains[0])).toBe(true);
  });

  it.each(["", " ", "unknown", "GCP_PM_ML_ENG,unknown", "data-engineer", "GCP_PM_ML_ENG,",
    ",GCP_PM_ML_ENG", "GCP_PM_ML_ENG,,data-engineer", "GCP_PM_ML_ENG,GCP_PM_ML_ENG",
    "gcp_pm_ml_eng", "machine-learning-engineer", "__proto__", "constructor"])("fails closed without PMLE fallback for bad config: %s", config => {
    vi.stubEnv("CHATGPT_EXAMS", config);
    expect(exams.getChatgptExams()).toEqual([]);
    expect(exams.getChatgptExam("GCP_PM_ML_ENG")).toBeUndefined();
  });

  it("trims whitespace, preserves allowlist order and maps the extra set from a known standard guide", async () => {
    await extraSets({ "data-engineer": { version: 1, source: syntheticSource, question_ids: [extraId] } });
    vi.stubEnv("CHATGPT_EXAMS", " data-engineer , GCP_PM_ML_ENG ");
    const enabled = exams.getChatgptExams();
    expect(enabled.map(exam => exam.id)).toEqual(["data-engineer", "GCP_PM_ML_ENG"]);
    const extra = enabled[0];
    expect(extra.certId).toBe("data-engineer");
    expect(extra.questionIds).toEqual([extraId]);
    expect(extra.domains).toEqual(getCertification("data-engineer")!.guides[0].sections
      .filter(section => section.included).map(section => ({ domainCode: section.id,
        displayName: section.title, weight: section.weight_percent! / 100 })));
    expect(extra.domains.reduce((sum, domain) => sum + domain.weight, 0)).toBeCloseTo(1);
    expect(exams.getChatgptExam("data-engineer")).toEqual(extra);
  });

  it("accepts bounded IDs-only selection provenance and optional blueprint hash", async () => {
    await extraSets({ "data-engineer": { version: 1, question_ids: [extraId],
      source: { ...syntheticSource, blueprint_sha256: "b".repeat(64) } } });
    vi.stubEnv("CHATGPT_EXAMS", "data-engineer");
    expect(exams.getChatgptExam("data-engineer")?.questionIds).toEqual([extraId]);
  });

  it("rejects the whole config when enabled sets share an ID", async () => {
    await extraSets({ "data-engineer": { version: 1, source: syntheticSource, question_ids: [freeSet.question_ids[0]] } });
    vi.stubEnv("CHATGPT_EXAMS", "GCP_PM_ML_ENG,data-engineer");
    expect(exams.getChatgptExams()).toEqual([]);
    expect(exams.getChatgptExam("GCP_PM_ML_ENG")).toBeUndefined();
    expect(exams.getChatgptExam("data-engineer")).toBeUndefined();
  });

  it("does not implicitly enable PMLE when only an extra set is selected", async () => {
    await extraSets({ "data-engineer": { version: 1, source: syntheticSource, question_ids: [extraId] } });
    vi.stubEnv("CHATGPT_EXAMS", "data-engineer");
    expect(exams.getChatgptExams().map(exam => exam.id)).toEqual(["data-engineer"]);
    expect(exams.getChatgptExam("GCP_PM_ML_ENG")).toBeUndefined();
  });

  it("does not accept a fixed set for an unknown certification or a beta-only guide", async () => {
    await extraSets({ unknown: { version: 1, source: syntheticSource, question_ids: [extraId] },
      "agentic-architect": { version: 1, source: syntheticSource, question_ids: [extraId] } });
    for (const id of ["unknown", "agentic-architect"]) {
      vi.stubEnv("CHATGPT_EXAMS", id);
      expect(exams.getChatgptExams()).toEqual([]);
    }
  });

  it.each([null, [], "invalid", { "GCP_PM_ML_ENG": { version: 1, source: syntheticSource, question_ids: [extraId] } }])(
    "fails closed for malformed extra-set map or a PMLE override", async value => {
      await extraSets(value);
      expect(exams.getChatgptExams()).toEqual([]);
    });

  it.each([{}, { version: 2, question_ids: [extraId] }, { version: 1, source: syntheticSource, question_ids: [] },
    { version: 1, source: syntheticSource, question_ids: [extraId, extraId] }, { version: 1, source: syntheticSource, question_ids: ["not-a-uuid"] },
    { version: 1, source: syntheticSource, question_ids: [extraId], questions: ["synthetic unexpected payload"] },
    { version: 1, question_ids: [extraId], source: "invalid" },
  ])("fails closed for malformed enabled extra set", async value => {
    await extraSets({ "data-engineer": value });
    vi.stubEnv("CHATGPT_EXAMS", "GCP_PM_ML_ENG,data-engineer");
    expect(exams.getChatgptExams()).toEqual([]);
  });

  it.each([
    undefined,
    { ...syntheticSource, stem: "synthetic-nested-content" },
    { ...syntheticSource, nested: { stem: "synthetic-nested-content" } },
    { ...syntheticSource, kind: "synthetic-free-text" },
    { ...syntheticSource, upstream: "synthetic-free-text" },
    { ...syntheticSource, exported_at: "2026-10-22" },
    { ...syntheticSource, exported_at: "2026-02-30T00:00:00.000Z" },
    { ...syntheticSource, exported_at: "2026-10-22T00:00:00Z" },
    { ...syntheticSource, exported_at: "2026-10-22T00:00:00.000+00:00" },
    { ...syntheticSource, export_sha256: "A".repeat(64) },
    { ...syntheticSource, export_sha256: "a".repeat(65) },
    { ...syntheticSource, blueprint_sha256: "not-a-digest" },
    { ...syntheticSource, selection: "synthetic free text" },
    { ...syntheticSource, selection: "a".repeat(101) },
    { ...syntheticSource, selection: "synthetic--test" },
    { ...syntheticSource, selection: { stem: "synthetic-nested-content" } },
  ])("rejects unsafe provenance even on a disabled additional manifest", async source => {
    await extraSets({ "data-engineer": { version: 1, source, question_ids: [extraId] } });
    expect(exams.getChatgptExams()).toEqual([]);
    vi.stubEnv("CHATGPT_EXAMS", "GCP_PM_ML_ENG,data-engineer");
    expect(exams.getChatgptExams()).toEqual([]);
  });

  it.each([
    { ...freeSet.source, stem: "synthetic-nested-content" },
    { ...freeSet.source, kind: "synthetic-free-text" },
    { ...freeSet.source, upstream: "synthetic-free-text" },
    { ...freeSet.source, exported_at: "2026-02-30T00:00:00.000Z" },
    { ...freeSet.source, export_sha256: "A".repeat(64) },
    { ...freeSet.source, blueprint_sha256: undefined },
    { ...freeSet.source, selection: "synthetic free text" },
  ])("rejects unsafe PMLE provenance without changing the original artifact", async source => {
    vi.doMock("@/lib/chatgpt/free-set.json", () => ({ default: { ...freeSet, source } }));
    vi.resetModules();
    exams = await import("@/lib/chatgpt/exams");
    expect(exams.getChatgptExams()).toEqual([]);
  });

  it.each([
    { ...freeSet, question_ids: freeSet.question_ids.slice(1) },
    { ...freeSet, question_ids: [...freeSet.question_ids, extraId] },
    { ...freeSet, question_ids: [...freeSet.question_ids.slice(1), freeSet.question_ids[1]] },
    { ...freeSet, question_ids: ["invalid", ...freeSet.question_ids.slice(1)] },
    { ...freeSet, version: 2 }, { ...freeSet, source: undefined }, { ...freeSet, questions: [] },
  ])("preserves strict PMLE selection constraints", async value => {
    vi.doMock("@/lib/chatgpt/free-set.json", () => ({ default: value }));
    vi.resetModules();
    exams = await import("@/lib/chatgpt/exams");
    expect(exams.getChatgptExams()).toEqual([]);
  });

  it.each(["missing", "ambiguous", "empty", "invalid weight", "invalid id", "duplicate domain", "blank title", "wrong cert"])(
    "fails closed for invalid stored guide mapping: %s", async invalid => {
      const cert = structuredClone(getCertification("machine-learning-engineer")!);
      if (invalid === "missing") cert.guides = [];
      if (invalid === "ambiguous") cert.guides.push(structuredClone(cert.guides[0]));
      if (invalid === "empty") cert.guides[0].sections = [];
      if (invalid === "invalid weight") cert.guides[0].sections[0].weight_percent = -1;
      if (invalid === "invalid id") cert.guides[0].sections[0].id = "wrong:section";
      if (invalid === "duplicate domain") cert.guides[0].sections[1] = structuredClone(cert.guides[0].sections[0]);
      if (invalid === "blank title") cert.guides[0].sections[0].title = " ";
      if (invalid === "wrong cert") cert.cert_id = "data-engineer";
      await certMock(cert);
      expect(exams.getChatgptExams()).toEqual([]);
    });

  it("fails closed if the stored guide cannot be read", async () => {
    vi.doMock("@/lib/certifications/data", () => ({ getCertification: () => { throw new Error("synthetic read failure"); } }));
    vi.resetModules();
    exams = await import("@/lib/chatgpt/exams");
    expect(() => exams.getChatgptExams()).not.toThrow();
    expect(exams.getChatgptExams()).toEqual([]);
  });
});
