import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MockResults } from "@/components/mock-results";
import { PracticeSummary } from "@/components/practice-summary";
const mocks = vi.hoisted(() => ({ result: { sessionId: "session", score: 100, totalQuestions: 1, correctAnswers: 1, withdrawnCount: 1,
  completedAt: "2026-10-24T12:00:00Z", timedOut: false, allocationNotice: null, domainBreakdown: [],
  review: [{ itemId: "active-item", ordinal: 2, stem: "Active question only", domainCode: "A", domainName: "Domain", selectedLabel: "A", correctLabel: "A", isCorrect: true,
    options: [{ label: "A", text: "First" }, { label: "B", text: "Second" }] }] } }));
vi.mock("@/components/mock-resource", () => ({ useMockResource: () => ({ data: mocks.result, error: null, reload: vi.fn() }), MockError: () => null }));
vi.mock("@/components/practice-resource", () => ({ usePracticeResource: () => ({ data: mocks.result, error: null, reload: vi.fn() }), PracticeError: () => null, PracticeLoading: () => null }));
describe("withdrawn review messaging", () => {
  it("tells mock users the item was excluded, not wrong, and offers reporting for active review", () => {
    const html = renderToStaticMarkup(createElement(MockResults, { sessionId: "session" }));
    expect(html).toContain("excluded from your score and review, not marked incorrect");
    expect(html).toContain("1 of 1 correct"); expect(html).toContain("Report a problem with this question");
  });
  it("tells practice users withdrawn questions are excluded from score and review", () => {
    const html = renderToStaticMarkup(createElement(PracticeSummary, { sessionId: "session" }));
    expect(html).toContain("withdrawn question(s) were excluded from your score and review");
    expect(html).toContain("Active question only");
  });
});
