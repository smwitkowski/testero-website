import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FreeDiagnosticExplanation } from "@/components/free-diagnostic-explanation";
const mocks = vi.hoisted(() => ({ track: vi.fn(), reload: vi.fn(), data: null as unknown, error: null as string | null }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: (effect: () => void) => effect(), useRef: (value: unknown) => ({ current: value }) }));
vi.mock("@/lib/analytics/client", () => ({ trackResults: mocks.track }));
vi.mock("@/components/diagnostic-resource", () => ({ useDiagnosticResource: () => ({ data: mocks.data, error: mocks.error, reload: mocks.reload }) }));
vi.mock("@/components/billing-account", () => ({ useFreshAccessOnFocus: vi.fn() }));
const result = { sessionId: "session", totalQuestions: 20, correctAnswers: 10, score: 50, readiness: { id: "building" as const, label: "Building", description: "Guidance" }, domainBreakdown: [] };
const question = { itemId: "chosen", ordinal: 5, stem: "Scenario", domainName: "Pipelines", domainCode: "A", isCorrect: false, selectedLabel: "A", correctLabel: "B", options: [{ label: "A", text: "Wrong", explanation: "Why wrong" }, { label: "B", text: "Right", explanation: "Why right" }] };
beforeEach(() => { vi.clearAllMocks(); mocks.data = null; mocks.error = null; });
it.each([5, 10, 20])("shows rationales, report control and count-safe CTA for %i questions", totalQuestions => {
  const report = { ...result, totalQuestions };
  mocks.data = question;
  const node = FreeDiagnosticExplanation({ result: report });
  const html = renderToStaticMarkup(node);
  expect(html).toContain("Why wrong"); expect(html).toContain("Why right");
  expect(html).toContain("Report a problem with this question");
  expect(html).toContain("Unlock PMLE Pass: $39");
  expect(html).toContain('href="/signup?next=%2Fpricing"');
  expect(html).not.toContain("Question review navigation");
  expect(html).not.toContain(">Question review</h2>");
  expect(mocks.track).toHaveBeenCalledWith("free_explanation_viewed", report);

});
it("does not track a viewed explanation while loading or failed, and offers retry", () => {
  expect(renderToStaticMarkup(createElement(FreeDiagnosticExplanation, { result }))).toContain("Loading your free explanation");
  mocks.error = "Unavailable";
  const html = renderToStaticMarkup(createElement(FreeDiagnosticExplanation, { result }));
  expect(html).toContain("Retry explanation");
  expect(mocks.track).not.toHaveBeenCalled();
});
