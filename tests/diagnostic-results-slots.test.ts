import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticResults } from "@/components/diagnostic-results";
const mocks = vi.hoisted(() => ({ resource: vi.fn() }));
vi.mock("@/components/diagnostic-resource", () => ({ useDiagnosticResource: mocks.resource }));
vi.mock("@/components/free-diagnostic-explanation", () => ({ FreeDiagnosticExplanation: () => null }));
vi.mock("@/components/results-email-form", () => ({ ResultsEmailForm: () => createElement("p", null, "Default email form") }));
beforeEach(() => mocks.resource.mockReturnValue({ data: { sessionId: "session", score: 60, correctAnswers: 12, totalQuestions: 20, domainBreakdown: [] }, error: null, reload: vi.fn() }));
it("preserves the default email card and offers optional CTA and email slots", () => {
  const defaults = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session" }));
  expect(defaults).toContain("Default email form");
  const custom = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session", aboveFoldCta: createElement("p", null, "Alternate CTA"), emailCard: createElement("p", null, "Alternate email") }));
  expect(custom).toContain("Alternate CTA");
  expect(custom).toContain("Alternate email");
  expect(custom).not.toContain("Default email form");
  const hidden = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session", emailCard: null }));
  expect(hidden).not.toContain("Default email form");
});
