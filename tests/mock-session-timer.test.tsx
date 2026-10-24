import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockSession } from "@/components/mock-session";
import { mockRequest, useMockResource } from "@/components/mock-resource";
const lifecycle = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  // Isolate this component's effect wiring without adding a browser runtime dependency.
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => { lifecycle.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/mock-resource", () => ({ useMockResource: vi.fn(), mockRequest: vi.fn(), MockError: () => null }));
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const setData = vi.fn();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  lifecycle.effects.length = 0; setData.mockClear();
  vi.mocked(useMockResource).mockReturnValue({ data: { sessionId: id, status: "in_progress", startedAt: "2026-10-24T10:00:00Z", deadlineAt: "2026-10-24T12:00:00Z", serverNow: "2026-10-24T11:59:58Z", totalQuestions: 50, answeredCount: 0, allocationNotice: null, questions: [{ id: "item", ordinal: 1, domainCode: "test", stem: "Question", options: [{ label: "A", text: "Answer" }], selectedLabel: null }] }, setData, error: null, setError: vi.fn(), reload: vi.fn() });
  vi.mocked(mockRequest).mockReset().mockResolvedValue({ status: "completed", questions: [] });
});
afterEach(() => vi.useRealTimers());
describe("mock session component timer effect", () => {
  it("actually calls the submit API at server deadline without an answer click", async () => {
    MockSession({ sessionId: id });
    const cleanup = lifecycle.effects[0]();
    await vi.advanceTimersByTimeAsync(1000); expect(mockRequest).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockRequest).toHaveBeenCalledExactlyOnceWith(`/api/mock/${id}/submit`, { method: "POST" });
    expect(setData).toHaveBeenCalledWith({ status: "completed", questions: [] });
    await vi.advanceTimersByTimeAsync(10000); expect(mockRequest).toHaveBeenCalledOnce();
    if (cleanup) cleanup();
  });
  it("cleans up the real effect timer when the component leaves the page", async () => {
    MockSession({ sessionId: id });
    const cleanup = lifecycle.effects[0]();
    if (cleanup) cleanup();
    await vi.advanceTimersByTimeAsync(3000); expect(mockRequest).not.toHaveBeenCalled();
  });
});
