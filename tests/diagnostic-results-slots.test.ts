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
  expect(html).toContain("Sampled domain reads");
  expect(html).toContain("Domain A");
  expect(html).toContain("1 of 2 correct");
  expect(html).toContain("based on 2 questions");
  expect(html.indexOf("Free explanation")).toBeLessThan(html.indexOf("Default email form"));
  expect(html).toContain("review every answer");
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

it.each([false, true])("shows honest quick-check reads and targeted study advice (signed in: %s)", signedIn => {
  mocks.resource.mockReturnValue({ data: { sessionId: "session", score: 40, correctAnswers: 2, totalQuestions: 5, domainBreakdown: [{ domainCode: "WEAK", domainName: "Weakest domain", total: 1, correct: 0, percentage: 0 }], ...(signedIn ? { review: [] } : {}) } });
  const html = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session" }));
  expect(html).toContain('aria-label="Overall score"');
  expect(html).toContain("Tier: Building");
  expect(html).toContain("Sampled domain reads");
  expect(html).toContain("0 of 1 correct");
  expect(html).toContain("based on one question");
  expect(html).not.toContain("Focus area");
  expect(html).toContain("One question cannot measure a domain");
  expect(html).toContain('id="next-step">Weakest domain');
  expect(html).toContain(`href="${signedIn ? "/dashboard?domain=WEAK" : "/signup?next=%2Fdashboard%3Fdomain%3DWEAK"}"`);
  expect(html).toContain('href="/diagnostic?length=20"');
  expect(html).toContain(signedIn ? "Signed-in unlock" : "Secondary pass option");
  if (!signedIn) {
    expect(html).toContain("practice 60 questions a month");
    expect(html.indexOf("Free explanation")).toBeLessThan(html.indexOf("Create free account"));
    expect(html.indexOf("Free explanation")).toBeLessThan(html.indexOf("Secondary pass option"));
  }
});
it("offers a new diagnostic rather than retry for an unavailable results link", () => {
  mocks.resource.mockReturnValue({ error: "Unavailable" });
  const html = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "missing" }));
  expect(html).toContain("Take a new diagnostic");
  expect(html).not.toContain("Retry");
});
it.each([10, 20])("preserves domain scores and targeted next steps for %s-question results", totalQuestions => {
  mocks.resource.mockReturnValue({ data: { sessionId: "session", score: 40, correctAnswers: totalQuestions * 0.4, totalQuestions, domainBreakdown: [{ domainCode: "WEAK", domainName: "Weakest domain", total: 2, correct: 0, percentage: 0 }], review: [] } });
  const html = renderToStaticMarkup(createElement(DiagnosticResults, { sessionId: "session" }));
  expect(html).toContain("Score by domain");
  expect(html).toContain("Domain results, weakest first");
  expect(html).toContain('id="next-step">Weakest domain');
  expect(html).toContain('href="/dashboard?domain=WEAK"');
  expect(html).toContain("Choose this domain on your dashboard");
});
