import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startMockCountdown } from "@/lib/mock/timer";
beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] }));
afterEach(() => vi.useRealTimers());
const start = "2026-10-24T10:00:00Z";
describe("mock client countdown used by the exam UI", () => {
  it("counts the server-reported remaining time and auto-submits at expiry exactly once", () => {
    const tick = vi.fn(); const submit = vi.fn(() => true);
    startMockCountdown({ deadlineAt: "2026-10-24T10:00:03Z", serverNow: start, onTick: tick, onExpire: submit });
    expect(tick).toHaveBeenLastCalledWith(3); expect(submit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000); expect(tick).toHaveBeenLastCalledWith(1); expect(submit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(tick).toHaveBeenLastCalledWith(0); expect(submit).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10000); expect(submit).toHaveBeenCalledOnce();
  });
  it("resumes only the remaining server time, not a new120-minute timer", () => {
    const tick = vi.fn(); const submit = vi.fn(() => true);
    startMockCountdown({ deadlineAt: "2026-10-24T12:00:00Z", serverNow: "2026-10-24T11:59:58Z", onTick: tick, onExpire: submit });
    expect(tick).toHaveBeenLastCalledWith(2); vi.advanceTimersByTime(2000); expect(submit).toHaveBeenCalledOnce();
  });
  it("waits for an in-flight save, retries expiry and does not launch overlapping submits", () => {
    let saving = true; const submit = vi.fn();
    startMockCountdown({ deadlineAt: "2026-10-24T10:00:01Z", serverNow: start, onTick: vi.fn(), onExpire: () => {
      if (saving) return false; submit(); return true;
    } });
    vi.advanceTimersByTime(2000); expect(submit).not.toHaveBeenCalled();
    saving = false; vi.advanceTimersByTime(1000); expect(submit).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10000); expect(submit).toHaveBeenCalledOnce();
  });
  it("submits an already-expired resumed exam immediately and cancels on unmount", () => {
    const expired = vi.fn(() => true);
    startMockCountdown({ deadlineAt: start, serverNow: "2026-10-24T10:00:02Z", onTick: vi.fn(), onExpire: expired });
    expect(expired).toHaveBeenCalledOnce();
    const submit = vi.fn(() => true);
    const cleanup = startMockCountdown({ deadlineAt: "2026-10-24T10:00:05Z", serverNow: start, onTick: vi.fn(), onExpire: submit });
    cleanup(); vi.advanceTimersByTime(10000); expect(submit).not.toHaveBeenCalled();
  });
  it("ignores the browser wall-clock time setting", () => {
    const submit = vi.fn(() => true);
    startMockCountdown({ deadlineAt: "2026-10-24T10:00:02Z", serverNow: start, onTick: vi.fn(), onExpire: submit });
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2099-01-01T00:00:00Z"));
    vi.advanceTimersByTime(1000); expect(submit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(submit).toHaveBeenCalledOnce();
  });
});
