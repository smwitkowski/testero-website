import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticResults } from "@/components/diagnostic-results";
const mocks = vi.hoisted(() => ({ resource: vi.fn() }));
vi.mock("@/components/diagnostic-resource", () => ({ useDiagnosticResource: mocks.resource }));
vi.mock("@/components/free-diagnostic-explanation", () => ({ FreeDiagnosticExplanation: () => createElement("p", null, "Free explanation") }));
vi.mock("@/components/diagnostic-unlock", () => ({ DiagnosticPassOption: () => createElement("p", null, "Secondary pass option"), SignedInDiagnosticUnlock: () => createElement("p", null, "Signed-in unlock") }));
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

it("puts the score before the short-run note and keeps value before optional email", () => {
  mocks.resource.mockReturnValue({ data: { sessionId: "session", score: 40, correctAnswers: 2, totalQuestions: 5, domainBreakdown: [{ domainCode: "A", domainName: "Domain A", total: 2, correct: 1, percentage: 50 }] } });
  const html = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session" }));
  expect(html.indexOf('aria-label="Overall score"')).toBeLessThan(html.indexOf("Based on 5 questions"));
  expect(html.indexOf("Score by domain")).toBeLessThan(html.indexOf("Free explanation"));
  expect(html.indexOf("Free explanation")).toBeLessThan(html.indexOf("Default email form"));
  expect(html).toContain("review your answers");
  expect(html).not.toContain(">Review your answers</h2>");
});
it("replaces email acquisition with account review and pass access check for signed-in owners", () => {
  mocks.resource.mockReturnValue({ data: { sessionId: "session", score: 60, correctAnswers: 12, totalQuestions: 20, domainBreakdown: [], review: [] } });
  const html = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session" }));
  expect(html).toContain("Signed-in unlock");
  expect(html).not.toContain("Default email form");
  expect(html).not.toContain("Free explanation");
  expect(html.indexOf("Question review")).toBeLessThan(html.indexOf("Signed-in unlock"));
});
