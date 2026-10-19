import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticSession } from "@/components/diagnostic-session";
import { diagnosticRequest } from "@/components/diagnostic-resource";

const mocks = vi.hoisted(() => ({ answer: vi.fn(), completed: vi.fn(), request: vi.fn(), reload: vi.fn(), replace: vi.fn(), viewOrdinal: null as number | null, totalQuestions: 20, answeredCount: 2, nullStateCalls: 0 }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (value: unknown) => [value === "" ? "A" : value === null && ++mocks.nullStateCalls === 1 ? mocks.viewOrdinal : value, vi.fn()],
    useRef: (value: unknown) => ({ current: value }), useEffect: (effect: () => void) => { effect(); } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/analytics/client", () => ({ trackDiagnostic: mocks.completed, trackDiagnosticAnswer: mocks.answer }));
vi.mock("@/components/diagnostic-resource", () => ({ diagnosticRequest: mocks.request, requestError: () => "Failed",
  useDiagnosticResource: () => ({ data: { status: "in_progress", totalQuestions: mocks.totalQuestions, answeredCount: mocks.answeredCount,
    answeredQuestions: [{ id: "saved-item", ordinal: 1, domainCode: "D1", stem: "Saved private question", selectedLabel: "B", options: [{ label: "B", text: "Saved answer" }] }], currentQuestion: { id: "item", ordinal: mocks.answeredCount + 1, domainCode: "D2", stem: "Private question", options: [{ label: "A", text: "Private answer" }] } },
    error: null, reload: mocks.reload }) }));

function formIn(node: ReactElement): ReactElement<{ onSubmit: (event: { preventDefault: () => void }) => Promise<void> }> | undefined {
  if (node.type === "form") return node as ReturnType<typeof formIn>;
  const children = (node.props as { children?: unknown }).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child && typeof child === "object" && "props" in child) {
      const form = formIn(child as ReactElement); if (form) return form;
    }
  }
}
beforeEach(() => { vi.clearAllMocks(); mocks.viewOrdinal = null; mocks.totalQuestions = 20; mocks.answeredCount = 2; mocks.nullStateCalls = 0; });
afterEach(() => vi.unstubAllGlobals());
it("captures question metadata only after its answer was saved, before completion", async () => {
  mocks.request.mockResolvedValue({ completed: true, feedback: { itemId: "item", selectedLabel: "A", correctLabel: "A", isCorrect: true } });
  const form = formIn(DiagnosticSession({ sessionId: "session" }))!;
  await form.props.onSubmit({ preventDefault: vi.fn() });
  expect(diagnosticRequest).toHaveBeenCalledWith("/api/diagnostic/session/answer", expect.objectContaining({ body: JSON.stringify({ itemId: "item", selectedLabel: "A" }) }));
  expect(mocks.answer.mock.calls).toEqual([["session", 3, "D2", true]]);
  // The reveal shows first; results open only from its "See my results" button.
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.completed).toHaveBeenCalledWith("diagnostic_completed", "session");
  expect(mocks.answer.mock.invocationCallOrder[0]).toBeLessThan(mocks.completed.mock.invocationCallOrder[0]);
});
it("does not capture question answered when saving fails", async () => {
  mocks.request.mockRejectedValue(new Error("Save failed"));
  await formIn(DiagnosticSession({ sessionId: "session" }))!.props.onSubmit({ preventDefault: vi.fn() });
  expect(mocks.answer).not.toHaveBeenCalled(); expect(mocks.completed).not.toHaveBeenCalled();
});

it.each([[10, 5, true], [20, 10, true], [5, 2, false], [10, 4, false]])("shows halfway encouragement only at the midpoint of %s questions", (total, answered, visible) => {
  mocks.totalQuestions = total; mocks.answeredCount = answered;
  const html = renderToStaticMarkup(createElement(DiagnosticSession, { sessionId: "session" }));
  expect(html.includes("Halfway there.")).toBe(visible);
});
it("estimates one minute per remaining diagnostic question", () => {
  const html = renderToStaticMarkup(createElement(DiagnosticSession, { sessionId: "session" }));
  expect(html).toContain("~18 min left");
});

it("never submits or captures an answered event while viewing a saved question", async () => {
  mocks.viewOrdinal = 1;
  const form = formIn(DiagnosticSession({ sessionId: "session" }))!;
  await form.props.onSubmit({ preventDefault: vi.fn() });
  expect(diagnosticRequest).not.toHaveBeenCalled();
  expect(mocks.answer).not.toHaveBeenCalled();
  expect(mocks.completed).not.toHaveBeenCalled();
  mocks.nullStateCalls = 0;
  const html = renderToStaticMarkup(createElement(DiagnosticSession, { sessionId: "session" }));
  expect(html).toContain("Your saved answer");
  expect(html).toContain("Saved answer. Previous answers are read-only and cannot be changed.");
});
