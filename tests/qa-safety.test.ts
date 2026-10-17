import { describe, it, expect, vi, afterEach } from "vitest";
// @ts-expect-error Operational scripts are native ESM, not application TypeScript.
import { localURL, rest, pages } from "../scripts/qa/safety.mjs";
// @ts-expect-error Operational scripts are native ESM, not application TypeScript.
import { validateBank, remapDomains, assertEligibleSupply } from "../scripts/qa/mirror-bank.mjs";
afterEach(() => vi.restoreAllMocks());
describe("QA safety boundaries", () => {
  it("remaps same-code domains without changing source cache", () => {
    const bank = { exam_domains: [{ id: "prod", code: "CODE" }], questions: [{ id: "q", domain_id: "prod" }] };
    const result = remapDomains(bank, [{ id: "local", code: "CODE" }]);
    expect(result.questions[0].domain_id).toBe("local");
    expect(result.exam_domains[0].id).toBe("local");
    expect(bank.questions[0].domain_id).toBe("prod");
  });
  it("rejects remote, userinfo, wrong port, paths and query tricks", () => {
    for (const url of ["https://127.0.0.1:56541", "http://127.0.0.1:56542", "http://evil.test:56541", "http://user@localhost:56541", "http://localhost:56541/x", "http://localhost:56541/?host=evil", "http://localhost:56541/#x"]) expect(() => localURL(url)).toThrow();
    expect(localURL("http://127.0.0.1:56541")).toBe("http://127.0.0.1:56541");
  });
  it("refuses remote writes and non-content tables before fetch", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    await expect(rest("https://prod.test", "hidden", "questions", "", [{}])).rejects.toThrow();
    await expect(rest("http://127.0.0.1:56541", "hidden", "auth.users")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("paginates beyond 1000 children and refuses redirects", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      expect(init?.redirect).toBe("error");
      const offset = Number(new URL(String(_url)).searchParams.get("offset"));
      return new Response(JSON.stringify(Array.from({ length: offset < 1000 ? 500 : 3 }, (_, i) => ({ id: offset + i }))));
    });
    expect(await pages("http://127.0.0.1:56541", "hidden", "answers", "select=id")).toHaveLength(1003);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("fails incomplete inventory before import", () => {
    expect(() => assertEligibleSupply({ questions: [], answers: [], explanations: [], exam_domains: [] })).toThrow("Insufficient eligible");
  });
  it("rejects unrelated and private cache fields", () => {
    const bank = { version: 1, source: "https://qpjsgcdrgnoinnlxzeze.supabase.co", questions: [{ id: "11111111-1111-4111-8111-111111111111", domain_id: "22222222-2222-4222-8222-222222222222", status: "ACTIVE" }], answers: [], explanations: [], exam_domains: [{ id: "22222222-2222-4222-8222-222222222222" }] };
    expect(validateBank(bank)).toBe(bank);
    expect(() => validateBank({ ...bank, answers: [{ question_id: "foreign" }] })).toThrow();
    expect(() => validateBank({ ...bank, questions: [{ ...bank.questions[0], user_id: "private" }] })).toThrow();
  });
});
