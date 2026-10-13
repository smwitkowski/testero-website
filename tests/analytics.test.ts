import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), get_distinct_id: vi.fn(() => "anonymous-id") }));
vi.mock("posthog-js", () => ({ default: sdk }));
beforeEach(() => {
  vi.resetModules(); sdk.init.mockReset(); sdk.capture.mockReset(); sdk.identify.mockReset(); sdk.reset.mockReset();
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
    analytics.identifyAnalytics("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"); analytics.resetAnalytics();
    analytics.trackDiagnosticAnswer("session", 1, "D1");
    expect(analytics.analyticsHeaders()).toEqual({});
    expect(sdk.identify).not.toHaveBeenCalled(); expect(sdk.reset).not.toHaveBeenCalled();
    expect(sdk.init).not.toHaveBeenCalled(); expect(sdk.capture).not.toHaveBeenCalled();
  });
  it("initializes once with masked recording and persistent identity", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.initializeAnalytics();
    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.init).toHaveBeenCalledWith("unit-placeholder-not-a-real-key", expect.objectContaining({ api_host: "http://127.0.0.1:56545", autocapture: false, disable_session_recording: false, session_recording: { maskAllInputs: true, maskTextSelector: "*" }, persistence: "localStorage+cookie", person_profiles: "identified_only" }));
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
  it("sends checkout start with only the public offer name", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackCheckoutStarted();
    expect(sdk.capture.mock.calls).toEqual([["checkout_started", { plan_name: "PMLE Pass" }]]);
  });
  it.each(["diagnostic_started", "diagnostic_completed"] as const)("preserves %s without answers or explanations", async event => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackDiagnostic(event, "session");
    expect(sdk.capture.mock.calls).toEqual([[event, { session_id: "session", $insert_id: `${event}:session` }]]);
  });
  it("identifies only opaque UUIDs and resets identity after logout", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.identifyAnalytics("person@example.com");
    analytics.identifyAnalytics("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    analytics.resetAnalytics();
    expect(sdk.identify.mock.calls).toEqual([["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]]);
    expect(sdk.reset).toHaveBeenCalledOnce();
    expect(analytics.analyticsHeaders()).toEqual({ "X-PostHog-Distinct-Id": "anonymous-id" });
  });
  it("captures exactly the allowed answer metadata", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackDiagnosticAnswer("session", 3, "D2");
    expect(sdk.capture.mock.calls).toEqual([["diagnostic_question_answered", {
      session_id: "session", ordinal: 3, domain_code: "D2",
    }]]);
  });

});
