import { describe, expect, it } from "vitest";
import { computeResult, type ScoringItem } from "@/lib/diagnostic/scoring";

function item(domain: string, correct: boolean | null): ScoringItem {
  return { domain_code: domain, domain_name: `Domain ${domain}`, is_correct: correct };
}

describe("anonymous diagnostic aggregate scoring", () => {
  it("returns finite zero scores for an empty input", () => {
    const result = computeResult("empty", []);
    expect(result).toEqual({
      sessionId: "empty", score: 0, totalQuestions: 0, correctAnswers: 0,
      readiness: { id: "low", label: "Low", description: "Needs significant improvement. Focus on foundational concepts and consistent practice to build your readiness." },
      domainBreakdown: [],
    });
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("scores a normal 20-question diagnostic and groups domain aggregates", () => {
    const items = [
      ...Array.from({ length: 10 }, (_, index) => item("A", index < 7)),
      ...Array.from({ length: 10 }, (_, index) => item("B", index < 8)),
    ];
    const result = computeResult("session", items);
    expect(result.score).toBe(75);
    expect(result.totalQuestions).toBe(20);
    expect(result.correctAnswers).toBe(15);
    expect(result.readiness.id).toBe("ready");
    expect(result.domainBreakdown).toEqual([
      { domainCode: "A", domainName: "Domain A", total: 10, correct: 7, percentage: 70 },
      { domainCode: "B", domainName: "Domain B", total: 10, correct: 8, percentage: 80 },
    ]);
  });

  it.each([[1, 33], [2, 67], [3, 100], [0, 0]])("rounds %s out of 3 to %s percent", (correct, percentage) => {
    const result = computeResult("rounded", Array.from({ length: 3 }, (_, i) => item("A", i < correct)));
    expect(result.score).toBe(percentage);
    expect(result.domainBreakdown[0].percentage).toBe(percentage);
  });

  it("does not count unanswered/null items as correct", () => {
    const result = computeResult("unanswered", [item("A", null), item("A", false), item("A", true)]);
    expect(result.correctAnswers).toBe(1);
    expect(result.totalQuestions).toBe(3);
    expect(result.score).toBe(33);
  });

  it("uses the rounded score with the verified readiness thresholds", () => {
    const result = computeResult("tier", Array.from({ length: 20 }, (_, i) => item("A", i < 17)));
    expect(result.score).toBe(85);
    expect(result.readiness.id).toBe("strong");
  });

  it("exposes only aggregate result fields, with no question or answer key data", () => {
    const enrichedItem = { ...item("A", true), stem: "secret", correct_label: "C", options: [{ label: "C", text: "secret" }] };
    const result = computeResult("safe", [enrichedItem]);
    expect(Object.keys(result)).toEqual([
      "sessionId", "score", "totalQuestions", "correctAnswers", "readiness", "domainBreakdown",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/secret|correct_label|options|stem|is_correct/);
  });

  it("does not mutate frozen session items", () => {
    const items = Object.freeze([Object.freeze(item("A", true)), Object.freeze(item("B", false))]);
    expect(computeResult("immutable", items).score).toBe(50);
    expect(items).toEqual([item("A", true), item("B", false)]);
  });
});
