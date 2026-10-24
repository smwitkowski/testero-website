import { describe, expect, it } from "vitest";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { calculateDomainTargets } from "@/lib/diagnostic/pmle-selection";
import { selectMockQuestions, MOCK_DURATION_MINUTES, MOCK_QUESTION_COUNT } from "@/lib/mock/selection";
const bank = (size = 20) => PMLE_BLUEPRINT.flatMap((domain, i) => Array.from({ length: size }, (_, n) => ({ id: `${i}-${n}`, domain_code: domain.domainCode })));
describe("mock blueprint and fresh-first selection", () => {
  it("uses 50 unique originals in the blueprint mix with a 120-minute duration", () => {
    const result = selectMockQuestions(bank(), new Set());
    const targets = calculateDomainTargets(50, new Map(PMLE_BLUEPRINT.map(domain => [domain.domainCode, 100])));
    expect(result.questions).toHaveLength(MOCK_QUESTION_COUNT); expect(MOCK_DURATION_MINUTES).toBe(120);
    expect(new Set(result.questions.map(row => row.id)).size).toBe(50);
    for (const [code, count] of targets) expect(result.questions.filter(row => row.domain_code === code)).toHaveLength(count);
    expect(result.allocationNotice).toBeNull();
  });
  it("redistributes a depleted domain and discloses the changed mix", () => {
    const result = selectMockQuestions(bank().filter(row => row.domain_code !== PMLE_BLUEPRINT[0].domainCode), new Set());
    expect(result.questions).toHaveLength(50); expect(new Set(result.questions.map(row => row.id)).size).toBe(50);
    expect(result.allocationNotice).toMatch(/shortfall/);
  });
  it("never uses seen questions while at least 50 unseen exist, even across domains", () => {
    const rows = bank(60); const seen = new Set(rows.filter(row => row.domain_code !== PMLE_BLUEPRINT[5].domainCode).map(row => row.id));
    const result = selectMockQuestions(rows, seen);
    expect(result.questions).toHaveLength(50); expect(result.questions.every(row => !seen.has(row.id))).toBe(true);
    expect(result.allocationNotice).toMatch(/shortfall/);
  });
  it("uses every unseen question before seen fallback and returns stable count", () => {
    const rows = bank(); const unseen = new Set(rows.slice(0, 7).map(row => row.id));
    const seen = new Set(rows.filter(row => !unseen.has(row.id)).map(row => row.id));
    const result = selectMockQuestions(rows, seen);
    expect(result.questions).toHaveLength(50);
    for (const id of unseen) expect(result.questions.some(row => row.id === id)).toBe(true);
    expect(result.questions.slice(0, 7).every(row => unseen.has(row.id))).toBe(true);
    expect(result.questions.slice(7).every(row => seen.has(row.id))).toBe(true);
  });
  it("honestly repeats only if the entire eligible bank has fewer than 50 questions", () => {
    const rows = bank(3); const result = selectMockQuestions(rows, new Set());
    expect(result.questions).toHaveLength(50); expect(new Set(result.questions.map(row => row.id)).size).toBe(18);
    expect(new Set(result.questions.slice(0, 18).map(row => row.id)).size).toBe(18);
    expect(result.allocationNotice).toMatch(/repeats questions/);
  });
  it("does not invent questions for empty or foreign pools, or count duplicate IDs as inventory", () => {
    expect(selectMockQuestions([{ id: "foreign", domain_code: "foreign" }], new Set()).questions).toEqual([]);
    const result = selectMockQuestions([bank()[0], bank()[0]], new Set());
    expect(result.questions).toHaveLength(50); expect(new Set(result.questions.map(row => row.id)).size).toBe(1);
    expect(result.allocationNotice).toMatch(/repeats/);
  });
});
