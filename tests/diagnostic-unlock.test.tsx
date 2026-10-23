import { beforeEach, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticPassOption, DiagnosticUnlockCard, SignedInDiagnosticUnlock } from "@/components/diagnostic-unlock";
const mocks = vi.hoisted(() => ({ resource: vi.fn(), track: vi.fn() }));
vi.mock("@/components/diagnostic-resource", () => ({ useDiagnosticResource: mocks.resource }));
vi.mock("@/lib/analytics/client", () => ({ trackResults: mocks.track }));
const result = { sessionId: "session", score: 40, correctAnswers: 2, totalQuestions: 5, readiness: { id: "building" as const, label: "Building", description: "Study guidance" }, domainBreakdown: [] };
beforeEach(() => { vi.clearAllMocks(); });
it("offers account creation anonymously and the existing checkout button for a verified free account", () => {
  const anonymous = renderToStaticMarkup(createElement(DiagnosticUnlockCard, { result }));
  expect(anonymous).toContain('href="/signup?next=%2Fpricing"');
  expect(anonymous).toContain("Unlock PMLE Pass: $39");
  expect(anonymous).toContain("Explanations for every question + progress tracking + unlimited practice");
  expect(anonymous).toContain("no auto-renew");
  mocks.resource.mockReturnValue({ data: { signedIn: true, owned: false }, error: null });
  const signedIn = renderToStaticMarkup(createElement(SignedInDiagnosticUnlock, { result }));
  expect(signedIn).toContain("Unlock PMLE Pass: $39</button>");
  expect(signedIn).not.toContain("/signup");
});
it.each([{ signedIn: true, owned: true }, { signedIn: false }, null])("does not advertise a purchase until free signed-in access is verified: %j", data => {
  mocks.resource.mockReturnValue({ data, error: null });
  expect(renderToStaticMarkup(createElement(SignedInDiagnosticUnlock, { result }))).toBe("");
});
it("offers retry instead of purchase when the access check fails", () => {
  mocks.resource.mockReturnValue({ data: null, error: "Unavailable", reload: vi.fn() });
  const html = renderToStaticMarkup(createElement(SignedInDiagnosticUnlock, { result }));
  expect(html).toContain("Retry access check");
  expect(html).not.toContain("Unlock PMLE Pass");
});
it("keeps the results unlock event on the anonymous CTA", () => {
  const card = DiagnosticUnlockCard({ result });
  const button = card.props.children[2] as ReactElement<{ children: ReactElement<{ onClick: () => void }> }>;
  button.props.children.props.onClick();
  expect(mocks.track).toHaveBeenCalledWith("unlock_cta_clicked", result);
});

it.each([false, true])("sends the PMLE Pass summary link to pricing (account: %s)", signedIn => {
  const html = renderToStaticMarkup(createElement(DiagnosticPassOption, { result: { ...result, ...(signedIn ? { review: [] } : {}) } }));
  expect(html).toContain('href="/pricing"');
  expect(html).not.toContain("/signup");
});
