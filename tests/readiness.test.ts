import { describe, expect, it } from "vitest";
import { getDomainTier, getExamReadinessTier } from "@/lib/readiness";

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
