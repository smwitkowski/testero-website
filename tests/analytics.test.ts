import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), set_config: vi.fn(), stopSessionRecording: vi.fn(), get_distinct_id: vi.fn(() => "anonymous-id") }));
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
    analytics.initializeAnalytics("/diagnostic"); analytics.initializeAnalytics("/diagnostic");
    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.init).toHaveBeenCalledWith("unit-placeholder-not-a-real-key", expect.objectContaining({ api_host: "http://127.0.0.1:56545", autocapture: false, disable_session_recording: false, session_recording: { maskAllInputs: true, maskTextSelector: "*" }, persistence: "localStorage+cookie", person_profiles: "identified_only" }));
  });
  it("keeps recording and surveys off on content routes and switches on app navigation", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.configureAnalyticsForPath("/blog?utm_source=reddit");
    expect(sdk.init).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ disable_session_recording: true, disable_surveys: true }));
    analytics.configureAnalyticsForPath("/diagnostic");
    expect(sdk.set_config).toHaveBeenLastCalledWith({ disable_session_recording: false });
    for (const path of ["/", "/faq/how-long", "/pricing", "/blog/post"]) {
      analytics.configureAnalyticsForPath("/practice/session");
      analytics.configureAnalyticsForPath(path);
      expect(sdk.set_config).toHaveBeenLastCalledWith({ disable_session_recording: true });
    }
    expect(sdk.stopSessionRecording).toHaveBeenCalled();
    vi.stubGlobal("window", { location: { origin: "https://testero.ai" } });
    analytics.trackPageview("/blog?utm_source=reddit&utm_campaign=pmle");
    expect(sdk.capture).toHaveBeenCalledWith("$pageview", { $current_url: "https://testero.ai/blog?utm_source=reddit&utm_campaign=pmle" });
    vi.unstubAllGlobals();
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
  it("captures only tool IDs and allowlisted certification IDs, never input values or URL fragments", async () => {
    const analytics = await import("@/lib/analytics/client");
    vi.stubGlobal("window", { location: { origin: "https://testero.ai", pathname: "/tools/study-plan", search: "?email=private@example.com", hash: "#private" } });
    analytics.initializeAnalytics();
    analytics.trackPageview("/tools/study-plan?email=private@example.com#private");
    analytics.trackTool("tool_used", "study-plan", "machine-learning-engineer");
    analytics.trackTool("tool_result_viewed", "cert-picker", "private@example.com");
    expect(sdk.capture.mock.calls).toEqual([
      ["$pageview", { $current_url: "https://testero.ai/tools/study-plan" }],
      ["tool_used", { tool: "study-plan", cert_id: "machine-learning-engineer", $current_url: "https://testero.ai/tools/study-plan" }],
      ["tool_result_viewed", { tool: "cert-picker", $current_url: "https://testero.ai/tools/study-plan" }],
    ]);
    vi.unstubAllGlobals();
  });
  it("captures exactly the allowed answer metadata", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackDiagnosticAnswer("session", 3, "D2");
    expect(sdk.capture.mock.calls).toEqual([["diagnostic_question_answered", {
      session_id: "session", ordinal: 3, domain_code: "D2",
    }]]);
  });

});
