import { describe, expect, it } from "vitest";
import { PMLE_PASS_PRICE_DISPLAY } from "@/lib/billing/pmle-pass";
import { getLegalDocument } from "@/lib/content/loader";

const terms = getLegalDocument("terms");
const section = (heading: string) => terms.body.split(`## ${heading}\n`)[1]?.split("\n## ")[0];

describe("D-044 published terms", () => {
  it("retains literal approval and the reviewed update date", () => {
    expect(terms.approved).toBe(true);
    expect(terms.body).toContain("Last updated: October 24, 2026.");
  });

  it("describes unlimited free practice, correct answers and progress without free explanations", () => {
    const study = section("Study tools and accounts");
    expect(study).toContain("provides unlimited practice with no monthly cap");
    expect(study).toContain("right/wrong and the correct answer, with progress tracking including per-domain history and stats, but without explanations");
    expect(study).not.toMatch(/60 free|remaining allowance|allowance resets|without explanations or progress tracking/);
    expect(study).toContain("One server-selected question from each completed diagnostic has a free full explanation.");
    expect(study).toContain("Other diagnostic and practice explanations require paid access.");
  });

  it("matches the configured Pass price and lists paid study tools, not free features", () => {
    const pass = section("PMLE Pass and payments");
    expect(pass).toContain(`PMLE Pass costs **${PMLE_PASS_PRICE_DISPLAY} USD as a one-time payment for 90 days**`);
    expect(pass).toContain("full question explanations, timed full-length mock exams, fresh-first practice and weak-area drills while the pass is active");
    expect(pass).toContain("Fresh-first practice prioritizes questions you have not answered.");
    expect(pass).toContain("Weak-area drills select practice from your lowest-scoring objectives.");
    expect(pass).not.toMatch(/progress tracking|unlimited practice/);
    expect(pass).toContain("It is not a subscription and does not auto-renew.");
    expect(pass).toContain("Its 90-day period starts at the successful payment time, not your first practice session.");
  });

  it("preserves the seven-day refund policy unchanged", () => {
    expect(section("Seven-day refund policy")?.trim()).toBe("Request a refund within seven days of purchase by emailing [support@testero.ai](mailto:support@testero.ai) with enough information to identify your purchase. A refund ends the access granted by that pass. Your free account remains; a separate valid entitlement, if any, is unaffected. Nothing in these terms removes rights that applicable law does not allow us to exclude.");
  });
});
