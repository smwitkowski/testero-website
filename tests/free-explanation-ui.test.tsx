import { beforeEach, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FreeDiagnosticExplanation } from "@/components/free-diagnostic-explanation";
const mocks = vi.hoisted(() => ({ track: vi.fn(), reload: vi.fn(), data: null as unknown, error: null as string | null }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: (effect: () => void) => effect(), useRef: (value: unknown) => ({ current: value }) }));
vi.mock("@/lib/analytics/client", () => ({ trackResults: mocks.track }));
vi.mock("@/components/diagnostic-resource", () => ({ useDiagnosticResource: () => ({ data: mocks.data, error: mocks.error, reload: mocks.reload }) }));
vi.mock("@/components/billing-account", () => ({ useFreshAccessOnFocus: vi.fn() }));
const result = { sessionId: "session", totalQuestions: 20, correctAnswers: 10, score: 50, readiness: { id: "building" as const, label: "Building", description: "Guidance" }, domainBreakdown: [] };
const question = { itemId: "chosen", ordinal: 5, stem: "Scenario", domainName: "Pipelines", domainCode: "A", isCorrect: false, selectedLabel: "A", correctLabel: "B", options: [{ label: "A", text: "Wrong", explanation: "Why wrong" }, { label: "B", text: "Right", explanation: "Why right" }] };
function findLink(node: ReactElement): ReactElement<{ onClick: () => void }> | undefined {
  if ((node.props as { onClick?: unknown }).onClick && (node.props as { href?: string }).href) return node as ReturnType<typeof findLink>;
  const children = (node.props as { children?: unknown }).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child && typeof child === "object" && "props" in child) { const found = findLink(child as ReactElement); if (found) return found; }
  }
}
beforeEach(() => { vi.clearAllMocks(); mocks.data = null; mocks.error = null; });
it("shows all rationales and the signup-to-pricing CTA, then tracks its click", () => {
  mocks.data = question;
  const node = FreeDiagnosticExplanation({ result });
  const html = renderToStaticMarkup(node);
  expect(html).toContain("Why wrong"); expect(html).toContain("Why right");
  expect(html).toContain("Report a problem with this question");
  expect(html).toContain("Unlock explanations for all 20 + unlimited practice: $39 one-time, 90 days");
  expect(html).toContain('href="/signup?next=%2Fpricing"');
  expect(mocks.track).toHaveBeenCalledWith("free_explanation_viewed", result);
  findLink(node)!.props.onClick();
  expect(mocks.track).toHaveBeenCalledWith("unlock_cta_clicked", result);
});
it("does not track a viewed explanation while loading or failed, and offers retry", () => {
  expect(renderToStaticMarkup(createElement(FreeDiagnosticExplanation, { result }))).toContain("Loading your free explanation");
  mocks.error = "Unavailable";
  const html = renderToStaticMarkup(createElement(FreeDiagnosticExplanation, { result }));
  expect(html).toContain("Retry explanation");
  expect(mocks.track).not.toHaveBeenCalled();
});
