import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: sdk }));
beforeEach(() => {
  vi.resetModules(); sdk.init.mockReset(); sdk.capture.mockReset();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "unit-placeholder-not-a-real-key");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "http://127.0.0.1:56545");
});
afterEach(() => vi.unstubAllEnvs());
describe("private analytics event wiring", () => {
  it("makes no SDK calls when the optional key is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackSignupCompleted(); analytics.trackPractice("session");
    analytics.trackDiagnostic("diagnostic_started", "session");
    expect(sdk.init).not.toHaveBeenCalled(); expect(sdk.capture).not.toHaveBeenCalled();
  });
  it("initializes once without autocapture or session recording", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.initializeAnalytics();
    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.init).toHaveBeenCalledWith("unit-placeholder-not-a-real-key", expect.objectContaining({ api_host: "http://127.0.0.1:56545", autocapture: false, disable_session_recording: true, persistence: "memory", person_profiles: "identified_only" }));
  });
  it("sends signup completion without any user, email, or token properties", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackSignupCompleted();
    expect(sdk.capture.mock.calls).toEqual([["signup_completed"]]);
  });
  it("sends practice start with only its validated session identifier", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackPractice("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(sdk.capture.mock.calls).toEqual([["practice_started", { session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }]]);
  });
  it.each(["diagnostic_started", "diagnostic_completed"] as const)("preserves %s without answers or explanations", async event => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackDiagnostic(event, "session");
    expect(sdk.capture.mock.calls).toEqual([[event, { session_id: "session" }]]);
  });
});
