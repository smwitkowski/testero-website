import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PMLE_PASS_PRICE } from "@/lib/billing/pmle-pass";
import { captureFunnelEvent, isInternalRequest, scheduleFunnelEvent, trackPurchaseCompleted } from "@/lib/analytics/server";
const afterMock = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after: afterMock }));
const fetchMock = vi.fn();
beforeEach(() => {
  afterMock.mockReset();
  fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "unit-public-placeholder");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "http://127.0.0.1:56546");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("server purchase analytics", () => {
  it("makes no calls when optional analytics is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    await trackPurchaseCompleted("cs_test_opaque", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { analytics_enabled: "1" }); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses a stable deduplication hash without raw purchase or customer identity", async () => {
    await trackPurchaseCompleted("cs_test_opaque", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { analytics_enabled: "1" }); await trackPurchaseCompleted("cs_test_opaque", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { analytics_enabled: "1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe("http://127.0.0.1:56546/capture/");
    const payload = JSON.parse(request[1].body);
    expect(payload.event).toBe("purchase_completed");
    expect(Object.keys(payload.properties).sort()).toEqual(["distinct_id", "$insert_id", "$process_person_profile", "plan_name", "source", "$set_once", "revenue", "currency"].sort());
    expect(payload.properties.$insert_id).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.properties.distinct_id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(payload.properties.$process_person_profile).toBe(true);
    expect(payload.properties.plan_name).toBe("PMLE Pass");
    expect(request[1].body).not.toContain("cs_test_opaque");
    expect(fetchMock.mock.calls[1][1].body).toBe(request[1].body);
    expect(request[1].cache).toBe("no-store");
  });
  it("cannot undo a grant when the analytics transport fails", async () => {
    fetchMock.mockRejectedValue(new Error("transport unavailable"));
    await expect(trackPurchaseCompleted("cs_test_opaque", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { analytics_enabled: "1" })).resolves.toBeUndefined();
  });
});

describe("server funnel analytics", () => {
  it.each(["machine-learning-engineer", "data-engineer", "cloud-architect", "cloud-engineer", "generative-ai-leader", "agentic-architect"])("preserves cert_id on diagnostic events for %s", async certId => {
    for (const event of ["diagnostic_started", "diagnostic_completed"] as const) {
      await captureFunnelEvent(event, "session", { session_id: "session", cert_id: certId, length: 5 });
    }
    expect(fetchMock.mock.calls).toHaveLength(2);
    for (const [, init] of fetchMock.mock.calls) expect(JSON.parse(init.body).properties).toMatchObject({ session_id: "session", cert_id: certId, length: 5 });
  });
  it.each([5, 10, 20])("captures diagnostic length %i", async length => {
    await captureFunnelEvent("diagnostic_started", "session", { session_id: "session", length });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties.length).toBe(length);
  });
  it("uses the custom ingestion host, safe fields and stable completion ID", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await captureFunnelEvent("diagnostic_completed", "browser-id", { session_id: "session-id" });
    expect(timeout).toHaveBeenCalledWith(1000);
    timeout.mockRestore();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:56546/i/v0/e/");
    expect(JSON.parse(init.body)).toEqual({ api_key: "unit-public-placeholder", event: "diagnostic_completed", properties: {
      distinct_id: "browser-id", source: "server", $process_person_profile: false, session_id: "session-id", $insert_id: "server:diagnostic_completed:session-id",
    } });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.cache).toBe("no-store");
  });
  it("defaults the ingestion host and skips disabled analytics", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    await captureFunnelEvent("signup_completed", "user-id");
    expect(fetchMock.mock.calls[0][0]).toBe("https://us.i.posthog.com/i/v0/e/");
    fetchMock.mockClear(); vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    await captureFunnelEvent("signup_completed", "user-id");
    scheduleFunnelEvent(new Request("http://localhost"), "signup_completed", "user-id");
    expect(fetchMock).not.toHaveBeenCalled(); expect(afterMock).not.toHaveBeenCalled();
  });
  it("defers capture, uses verified signup identity, and falls back for anonymous requests", async () => {
    scheduleFunnelEvent(new Request("http://localhost", { headers: { "X-PostHog-Distinct-Id": "browser_123" } }), "signup_completed", "user-id");
    expect(fetchMock).not.toHaveBeenCalled();
    await afterMock.mock.calls[0][0]();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties.distinct_id).toBe("user-id");
    scheduleFunnelEvent(new Request("http://localhost", { headers: { "X-PostHog-Distinct-Id": "learner@example.com" } }), "signup_completed", "user-id");
    await afterMock.mock.calls[1][0]();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).properties.distinct_id).toBe("user-id");
    scheduleFunnelEvent(new Request("http://localhost"), "diagnostic_completed", "session-id", { session_id: "session-id" });
    await afterMock.mock.calls[2][0]();
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).properties.distinct_id).toBe("session-id");
  });
  it("isolates scheduling, transport and timeout failures", async () => {
    afterMock.mockImplementation(() => { throw new Error("no request context"); });
    expect(() => scheduleFunnelEvent(new Request("http://localhost"), "signup_completed", "user-id")).not.toThrow();
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await expect(captureFunnelEvent("signup_completed", "user-id")).resolves.toBeUndefined();
  });
});

 it("waitlist capture includes only the cert and opaque identity, not email", async () => {
  await captureFunnelEvent("cert_waitlist_joined", "opaque-interest", { cert_id: "cloud-engineer" });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties).toEqual({ distinct_id: "opaque-interest", source: "server", $process_person_profile: false, cert_id: "cloud-engineer" });
});

describe("internal traffic is never captured server-side", () => {
  const req = (headers: Record<string, string>) => new Request("https://testero.ai/api/diagnostic", { method: "POST", headers });
  it.each([
    [{ "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36" }, true],
    [{ "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }, true],
    [{ "user-agent": "Mozilla/5.0 (Macintosh) Chrome/131.0", cookie: "a=1; testero_internal=1" }, true],
    [{ "user-agent": "Mozilla/5.0 (Macintosh) Chrome/131.0", cookie: "testero_internal=0" }, false],
    [{ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/15E148 Safari/604.1" }, false],
  ])("%j → internal=%s", (headers, internal) => {
    expect(isInternalRequest(req(headers))).toBe(internal);
    afterMock.mockReset();
    scheduleFunnelEvent(req(headers), "diagnostic_started", "anon_1", { session_id: "s1", length: 5 });
    expect(afterMock).toHaveBeenCalledTimes(internal ? 0 : 1);
  });
});

it.each([3999, 4250, 1999, 0])("reports the verified Stripe total %i, not a configured literal", async amountTotal => {
  await trackPurchaseCompleted("cs_test_opaque", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { analytics_enabled: "1" }, { amountTotal, currency: "usd" });
  const properties = JSON.parse(fetchMock.mock.calls[0][1].body).properties;
  expect(properties).toMatchObject({ revenue: amountTotal / 100, currency: "USD" });
});
it.each([undefined, { amountTotal: null, currency: null }, { amountTotal: -1, currency: "usd" }, { amountTotal: 1.5, currency: "usd" }])("falls back to the configured PMLE price when Stripe totals are unavailable: %j", async payment => {
  await trackPurchaseCompleted("cs_test_opaque", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { analytics_enabled: "1" }, payment);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties).toMatchObject({ revenue: PMLE_PASS_PRICE, currency: "USD" });
});
