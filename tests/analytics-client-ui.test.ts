import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticSession } from "@/components/diagnostic-session";
import { diagnosticRequest } from "@/components/diagnostic-resource";

const mocks = vi.hoisted(() => ({ answer: vi.fn(), completed: vi.fn(), request: vi.fn(), reload: vi.fn(), replace: vi.fn() }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (value: unknown) => [value === "" ? "A" : value, vi.fn()],
    useRef: (value: unknown) => ({ current: value }), useEffect: (effect: () => void) => { effect(); } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/analytics/client", () => ({ trackDiagnostic: mocks.completed, trackDiagnosticAnswer: mocks.answer }));
vi.mock("@/components/diagnostic-resource", () => ({ diagnosticRequest: mocks.request, requestError: () => "Failed",
  useDiagnosticResource: () => ({ data: { status: "in_progress", totalQuestions: 20, answeredCount: 2,
    currentQuestion: { id: "item", ordinal: 3, domainCode: "D2", stem: "Private question", options: [{ label: "A", text: "Private answer" }] } },
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
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => vi.unstubAllGlobals());
it("captures question metadata only after its answer was saved, before completion", async () => {
  mocks.request.mockResolvedValue({ completed: true });
  const form = formIn(DiagnosticSession({ sessionId: "session" }))!;
  await form.props.onSubmit({ preventDefault: vi.fn() });
  expect(diagnosticRequest).toHaveBeenCalledWith("/api/diagnostic/session/answer", expect.objectContaining({ body: JSON.stringify({ itemId: "item", selectedLabel: "A" }) }));
  expect(mocks.answer.mock.calls).toEqual([["session", 3, "D2"]]);
  expect(mocks.completed).toHaveBeenCalledWith("diagnostic_completed", "session");
  expect(mocks.answer.mock.invocationCallOrder[0]).toBeLessThan(mocks.completed.mock.invocationCallOrder[0]);
});
it("does not capture question answered when saving fails", async () => {
  mocks.request.mockRejectedValue(new Error("Save failed"));
  await formIn(DiagnosticSession({ sessionId: "session" }))!.props.onSubmit({ preventDefault: vi.fn() });
  expect(mocks.answer).not.toHaveBeenCalled(); expect(mocks.completed).not.toHaveBeenCalled();
});

it("estimates one minute per remaining diagnostic question", () => {
  const html = renderToStaticMarkup(createElement(DiagnosticSession, { sessionId: "session" }));
  expect(html).toContain("~18 min left");
});
