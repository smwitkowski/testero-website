import { afterEach, beforeEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), get_distinct_id: vi.fn(() => "anonymous-browser"), get_property: vi.fn(() => "anonymous") }));
vi.mock("posthog-js", () => ({ default: sdk }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "unit-placeholder-not-a-real-key");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "http://127.0.0.1:56545");
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([5, 10, 20])("sends exact safe metadata for every answer in a %i-question diagnostic", async total => {
  const analytics = await import("@/lib/analytics/client");
  analytics.initializeAnalytics("/diagnostic");
  for (let ordinal = 1; ordinal <= total; ordinal++) {
    analytics.trackDiagnosticAnswer("opaque-session", ordinal, "data-engineer:standard:1", ordinal % 2 === 0, "data-engineer", total);
  }
  expect(sdk.capture.mock.calls).toEqual(Array.from({ length: total }, (_, index) => ["diagnostic_question_answered", {
    session_id: "opaque-session", question_index: index + 1, total, domain: "data-engineer:standard:1",
    correct: (index + 1) % 2 === 0, exam: "data-engineer", length: total,
    $insert_id: `diagnostic_question_answered:opaque-session:${index + 1}`,
  }]));
});

it("gives retries of the same saved answer the same deduplication ID", async () => {
  const analytics = await import("@/lib/analytics/client");
  analytics.initializeAnalytics("/diagnostic");
  analytics.trackDiagnosticAnswer("opaque-session", 1, "D1", false);
  analytics.trackDiagnosticAnswer("opaque-session", 1, "D1", false);
  analytics.trackDiagnosticAnswer("opaque-session", 2, "D1", true);
  const ids = sdk.capture.mock.calls.map(([, properties]) => properties.$insert_id);
  expect(ids).toEqual(["diagnostic_question_answered:opaque-session:1", "diagnostic_question_answered:opaque-session:1", "diagnostic_question_answered:opaque-session:2"]);
});

it.each(["testero_internal=1", "other=1; testero_internal=1; consent=yes"])("excludes internal browsers (%s)", async cookie => {
  vi.stubGlobal("document", { cookie });
  const analytics = await import("@/lib/analytics/client");
  analytics.initializeAnalytics("/diagnostic");
  analytics.trackDiagnosticAnswer("opaque-session", 1, "D1", true, undefined, 5);
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.capture).not.toHaveBeenCalled();
});

it.each(["HeadlessChrome/140", "Playwright", "Googlebot/2.1", "Example Crawler", "Example Spider"])("excludes server-recognized automation (%s)", async userAgent => {
  vi.stubGlobal("navigator", { userAgent });
  const analytics = await import("@/lib/analytics/client");
  analytics.initializeAnalytics("/diagnostic");
  analytics.trackDiagnosticAnswer("opaque-session", 1, "D1", true, undefined, 5);
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.capture).not.toHaveBeenCalled();
});

it("stops answer capture if this browser is marked internal after initialization", async () => {
  const analytics = await import("@/lib/analytics/client");
  analytics.initializeAnalytics("/diagnostic");
  vi.stubGlobal("document", { cookie: "testero_internal=1" });
  analytics.trackDiagnosticAnswer("opaque-session", 1, "D1", true);
  expect(sdk.init).toHaveBeenCalledOnce();
  expect(sdk.capture).not.toHaveBeenCalled();
});

it("does not initialize or capture answers without an analytics key", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  const analytics = await import("@/lib/analytics/client");
  analytics.initializeAnalytics("/diagnostic");
  analytics.trackDiagnosticAnswer("opaque-session", 1, "D1", true);
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.capture).not.toHaveBeenCalled();
});
