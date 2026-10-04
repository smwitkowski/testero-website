import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PMLE_BLUEPRINT, validateBlueprintWeights } from "@/lib/constants/pmle-blueprint";
import {
  calculateDomainTargets,
  hasValidAnswers,
  selectPmleQuestionsByBlueprint,
  type CanonicalAnswer,
} from "@/lib/diagnostic/pmle-selection";

const codes = PMLE_BLUEPRINT.map((domain) => domain.domainCode);
const goodAnswers: CanonicalAnswer[] = [
  { choice_label: "A", choice_text: "Correct", is_correct: true },
  { choice_label: "B", choice_text: "Distractor", is_correct: false },
];

function availability(counts: number[]) {
  return new Map(codes.map((code, index) => [code, counts[index] ?? 0]));
}

function bank(counts: number[]) {
  return counts.flatMap((count, index) => Array.from({ length: count }, (_, number) => ({
    id: `question-${index}-${number}`,
    stem: `Question ${index}-${number}`,
    domain_id: `domain-${index}`,
    difficulty: "medium",
    answers: goodAnswers.map((answer) => ({ ...answer })),
    exam_domains: { code: codes[index], name: PMLE_BLUEPRINT[index].displayName },
  })));
}

type BankRow = ReturnType<typeof bank>[number];

function client(rows: BankRow[], errors: { counts?: string; domain?: string } = {}) {
  const filters: [string, string][] = [];
  const supabase = {
    from: vi.fn((table: string) => {
      expect(table).toBe("questions");
      let domainId: string | undefined;
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: string) => {
          filters.push([column, value]);
          if (column === "domain_id") domainId = value;
          return query;
        }),
        then(resolve: (result: { data: BankRow[] | null; error: { message: string } | null }) => unknown) {
          const message = domainId ? errors.domain : errors.counts;
          return Promise.resolve(resolve({
            data: message ? null : rows.filter((row) => !domainId || row.domain_id === domainId),
            error: message ? { message } : null,
          }));
        },
      };
      return query;
    }),
  };
  return { supabase: supabase as unknown as SupabaseClient, filters };
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

afterEach(() => vi.restoreAllMocks());

describe("blueprint target allocation", () => {
  it("retains the verified normal weighted allocation for 20", () => {
    expect(validateBlueprintWeights()).toBe(true);
    expect([...calculateDomainTargets(20, availability([50, 50, 50, 50, 50, 50])).values()])
      .toEqual([2, 3, 4, 4, 4, 3]);
  });

  it("caps targets by availability and redistributes all remaining slots", () => {
    const counts = [1, 0, 2, 30, 0, 0];
    const targets = calculateDomainTargets(20, availability(counts));
    expect([...targets.values()].reduce((sum, value) => sum + value, 0)).toBe(20);
    codes.forEach((code, index) => expect(targets.get(code)).toBeLessThanOrEqual(counts[index]));
    expect(targets.get(codes[3])).toBe(17);
  });

  it.each(codes)("fills 20 from a single available domain: %s", (code) => {
    const targets = calculateDomainTargets(20, new Map([[code, 25]]));
    expect(targets.get(code)).toBe(20);
    expect([...targets.values()].reduce((sum, value) => sum + value, 0)).toBe(20);
  });

  it("stops at capacity rather than looping forever", () => {
    expect([...calculateDomainTargets(20, availability([1, 2, 0, 0, 0, 0])).values()])
      .toEqual([1, 2, 0, 0, 0, 0]);
  });

  it("allocates zero without inventing inventory", () => {
    expect([...calculateDomainTargets(0, new Map()).values()]).toEqual([0, 0, 0, 0, 0, 0]);
    expect([...calculateDomainTargets(20, new Map()).values()]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it.each([-1, 1.5, NaN, Infinity])("rejects invalid question count %s", (count) => {
    expect(() => calculateDomainTargets(count, new Map())).toThrow("non-negative integer");
  });
});

describe("valid answer inventory", () => {
  it("accepts exactly one correct answer", () => expect(hasValidAnswers(goodAnswers)).toBe(true));
  it.each([
    null, undefined, [], [goodAnswers[0]],
    goodAnswers.map((a) => ({ ...a, is_correct: false })),
    goodAnswers.map((a) => ({ ...a, is_correct: true })),
    goodAnswers.map((a) => ({ ...a, choice_text: " " })),
    goodAnswers.map((a) => ({ ...a, choice_label: "A" })),
    [{ ...goodAnswers[0], is_correct: "true" }, goodAnswers[1]],
  ].map((answers) => ({ answers })))("rejects malformed answers %#", ({ answers }) => {
    expect(hasValidAnswers(answers)).toBe(false);
  });
});

describe("ported Supabase selector", () => {
  it("selects exactly 20 distinct valid questions from the 30-question seed shape", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const rows = bank([5, 5, 5, 5, 5, 5]);
    for (let seed = 1; seed <= 20; seed++) {
      vi.spyOn(Math, "random").mockImplementation(seededRandom(seed));
      const { supabase, filters } = client(rows);
      const result = await selectPmleQuestionsByBlueprint(supabase, 20);
      expect(result.questions).toHaveLength(20);
      expect(new Set(result.questions.map((q) => q.id)).size).toBe(20);
      expect(result.domainDistribution.map((d) => d.selectedCount)).toEqual([2, 3, 4, 4, 4, 3]);
      expect(result.questions.every((q) => hasValidAnswers(q.answers))).toBe(true);
      expect(filters).toContainEqual(["exam", "GCP_PM_ML_ENG"]);
      expect(filters).toContainEqual(["status", "ACTIVE"]);
      expect(filters).toContainEqual(["review_status", "GOOD"]);
    }
    expect(rows).toEqual(bank([5, 5, 5, 5, 5, 5]));
  });

  it("samples beyond a fixed prefix using deterministic Fisher-Yates seeds", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const rows = bank([30, 0, 0, 0, 0, 0]);
    const seen = new Map(rows.map((q) => [q.id, 0]));
    for (let seed = 1; seed <= 120; seed++) {
      vi.spyOn(Math, "random").mockImplementation(seededRandom(seed));
      const result = await selectPmleQuestionsByBlueprint(client(rows).supabase, 20);
      result.questions.forEach((q) => seen.set(q.id, seen.get(q.id)! + 1));
    }
    expect([...seen.values()].every((count) => count > 15 && count < 115)).toBe(true);
  });

  it("throws explicit insufficient inventory error, never a partial diagnostic", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(selectPmleQuestionsByBlueprint(client(bank([2, 2, 2, 2, 2, 2])).supabase, 20))
      .rejects.toThrow("Insufficient questions: requested 20, selected 12, total available 12");
  });

  it("throws explicit error when all domains are missing", async () => {
    await expect(selectPmleQuestionsByBlueprint(client([]).supabase, 20))
      .rejects.toThrow("Insufficient questions: requested 20, selected 0, total available 0");
  });

  it("filters malformed rows before availability counting and selection", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const rows = bank([21, 0, 0, 0, 0, 0]);
    rows[0].answers = [];
    const result = await selectPmleQuestionsByBlueprint(client(rows).supabase, 20);
    expect(result.domainDistribution[0].availableCount).toBe(20);
    expect(result.questions.map((q) => q.id)).not.toContain(rows[0].id);
  });

  it("does not count malformed rows as available inventory", async () => {
    const rows = bank([20, 0, 0, 0, 0, 0]);
    rows[0].answers = goodAnswers.map((a) => ({ ...a, is_correct: false }));
    await expect(selectPmleQuestionsByBlueprint(client(rows).supabase, 20))
      .rejects.toThrow("total available 19");
  });

  it("surfaces count query failures", async () => {
    await expect(selectPmleQuestionsByBlueprint(client([], { counts: "offline" }).supabase, 20))
      .rejects.toThrow("Failed to fetch domain counts: offline");
  });

  it("fails closed if a domain fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(selectPmleQuestionsByBlueprint(client(bank([25, 0, 0, 0, 0, 0]), { domain: "offline" }).supabase, 20))
      .rejects.toThrow("Insufficient questions: requested 20, selected 0");
  });
});
