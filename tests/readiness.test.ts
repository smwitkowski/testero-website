import { describe, expect, it } from "vitest";
import { getDomainStatus, getDomainTier, getExamReadinessTier, questionsToReady, weakestFirst } from "@/lib/readiness";

describe("ported readiness tiers", () => {
  it.each([
    [0, "low", "Low"], [39, "low", "Low"],
    [40, "building", "Building"], [69, "building", "Building"],
    [70, "ready", "Ready"], [84, "ready", "Ready"],
    [85, "strong", "Strong"], [100, "strong", "Strong"],
  ])("score %s yields %s", (score, id, label) => {
    expect(getExamReadinessTier(Number(score))).toMatchObject({ id, label });
    expect(getExamReadinessTier(Number(score)).description).toBeTruthy();
  });

  it.each([
    [0, "critical"], [39, "critical"], [40, "moderate"],
    [69, "moderate"], [70, "strong"], [100, "strong"],
  ])("domain score %s yields %s", (score, id) => {
    expect(getDomainTier(Number(score)).id).toBe(id);
  });

  it("describes diagnostic study guidance without a passing-score guarantee", () => {
    for (const score of [0, 40, 70, 85]) {
      const tier = getExamReadinessTier(score);
      expect(tier.description).not.toMatch(/guarantee|pass threshold|pass typically|pass score/i);
    }
    expect(getExamReadinessTier(85).description)
      .toBe("Well-prepared for the exam. Continue practicing to maintain your knowledge.");
  });
});

describe("diagnostic domain honesty", () => {
  it.each([
    [0, 3, "critical"], [1, 3, "critical"], [2, 3, "moderate"], [3, 3, "strong"],
    [0, 4, "critical"], [1, 4, "critical"], [2, 4, "moderate"], [3, 4, "moderate"], [4, 4, "strong"],
    // Quick checks: 1-2 questions per domain. All correct is never a focus area.
    [1, 1, "strong"], [0, 1, "critical"], [2, 2, "strong"], [1, 2, "critical"], [0, 2, "critical"],
  ])("%s of %s is %s, with the same rule for every small sample", (correct, total, id) => {
    expect(getDomainStatus(Number(correct), Number(total))).toBe(id);
  });
  it("orders weakest first by status, accuracy, then the given exam-guide order", () => {
    const domains = [
      { domainCode: "first", correct: 2, total: 3, percentage: 67 },
      { domainCode: "second", correct: 3, total: 4, percentage: 75 },
      { domainCode: "third", correct: 1, total: 4, percentage: 25 },
      { domainCode: "fourth", correct: 2, total: 3, percentage: 67 },
    ];
    expect(weakestFirst(domains).map(domain => domain.domainCode)).toEqual(["third", "first", "fourth", "second"]);
  });
  it.each([[55, 20, 3], [65, 20, 1], [69, 20, 1], [70, 20, 0], [0, 20, 14]])("score %s of %s questions needs ≈%s questions to Ready", (score, total, needed) => {
    expect(questionsToReady(Number(score), Number(total))).toBe(needed);
  });
});
