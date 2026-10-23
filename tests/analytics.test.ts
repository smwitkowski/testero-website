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
  it.each(["data-engineer", "cloud-architect", "cloud-engineer", "generative-ai-leader", "agentic-architect"])("tags beta diagnostic events with %s", async certId => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics();
    analytics.trackDiagnostic("diagnostic_started", "beta-session", 5, certId);
    analytics.trackDiagnosticAnswer("beta-session", 1, `${certId}:standard:1`, false, certId, 5);
    analytics.trackDiagnostic("diagnostic_completed", "beta-session", 5, certId);
    expect(sdk.capture.mock.calls.map(([event, properties]) => [event, properties.cert_id ?? properties.exam])).toEqual([
      ["diagnostic_started", certId], ["diagnostic_question_answered", certId], ["diagnostic_completed", certId],
    ]);
    expect(sdk.capture.mock.calls[1][1]).toEqual({ session_id: "beta-session", question_index: 1, total: 5, domain: `${certId}:standard:1`, correct: false, exam: certId, length: 5, $insert_id: "diagnostic_question_answered:beta-session:1" });
  });
  it("still excludes internal browsers from all beta diagnostic events", async () => {
    vi.stubGlobal("document", { cookie: "testero_internal=1" });
    try {
      const analytics = await import("@/lib/analytics/client");
      analytics.initializeAnalytics();
      analytics.trackDiagnostic("diagnostic_started", "beta-session", 5, "data-engineer");
      analytics.trackDiagnosticAnswer("beta-session", 1, "data-engineer:standard:1", true, "data-engineer");
      analytics.trackDiagnostic("diagnostic_completed", "beta-session", 5, "data-engineer");
      expect(sdk.init).not.toHaveBeenCalled();
      expect(sdk.capture).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it.each([5, 10, 20, 7])("includes only supported diagnostic length %i", async length => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics();
    analytics.trackDiagnostic("diagnostic_started", "session", length);
    const properties = sdk.capture.mock.calls[0][1];
    if ([5, 10, 20].includes(length)) expect(properties.length).toBe(length);
    else expect(properties).not.toHaveProperty("length");
  });
  it("makes no SDK calls when the optional key is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackSignupCompleted(); analytics.trackPractice("session");
    analytics.trackDiagnostic("diagnostic_started", "session");
    analytics.identifyAnalytics("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"); analytics.resetAnalytics();
    analytics.trackDiagnosticAnswer("session", 1, "D1", true);
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
  it("sends practice start with session and remaining quota metadata", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackPractice("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 1);
    expect(sdk.capture.mock.calls).toEqual([["practice_started", { session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", free_questions_remaining_at_check: 1 }]]);
  });
  it("sends checkout start with only the public offer name", async () => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackCheckoutStarted();
    expect(sdk.capture.mock.calls).toEqual([["checkout_started", { plan_name: "PMLE Pass" }]]);
  });
  it.each(["diagnostic_started", "diagnostic_completed"] as const)("preserves %s without answers or explanations", async event => {
    const analytics = await import("@/lib/analytics/client");
    analytics.initializeAnalytics(); analytics.trackDiagnostic(event, "session");
    expect(sdk.capture.mock.calls).toEqual([[event, { session_id: "session", cert_id: "machine-learning-engineer", $insert_id: `${event}:session` }]]);
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
    analytics.initializeAnalytics(); analytics.trackDiagnosticAnswer("session", 3, "D2", false);
    expect(sdk.capture.mock.calls).toEqual([["diagnostic_question_answered", {
      session_id: "session", question_index: 3, total: 20, domain: "D2", correct: false, exam: "machine-learning-engineer", length: 20,
      $insert_id: "diagnostic_question_answered:session:3",
    }]]);
  });

  it.each(["results_viewed", "free_explanation_viewed", "unlock_cta_clicked"] as const)("captures %s with aggregate scores only", async event => {
    const analytics = await import("@/lib/analytics/client");
    const result = { sessionId: "session", totalQuestions: 20, score: 50, correctAnswers: 10, readiness: { id: "building", label: "Building", description: "Guidance" },
      domainBreakdown: [{ domainCode: "A", domainName: "Domain A", total: 4, correct: 2, percentage: 50 }],
      email: "private@example.com", review: [{ stem: "Private question", explanation: "Private explanation" }] };
    analytics.trackResults(event, result as never);
    expect(sdk.capture.mock.calls).toEqual([[event, {
      session_id: "session", cert_id: "machine-learning-engineer", question_count: 20,
      domain_scores: [{ domain_code: "A", correct: 2, total: 4, percentage: 50 }],
      ...(event === "unlock_cta_clicked" ? {} : { $insert_id: `${event}:session` }),
    }]]);
    expect(JSON.stringify(sdk.capture.mock.calls)).not.toMatch(/private|email|stem|explanation"|domainName/);
  });

});
