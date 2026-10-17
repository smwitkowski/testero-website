import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureFunnelEvent, scheduleFunnelEvent, trackPurchaseCompleted } from "@/lib/analytics/server";
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
    await trackPurchaseCompleted("cs_test_opaque"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses a stable deduplication hash without raw purchase or customer identity", async () => {
    await trackPurchaseCompleted("cs_test_opaque"); await trackPurchaseCompleted("cs_test_opaque");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe("http://127.0.0.1:56546/capture/");
    const payload = JSON.parse(request[1].body);
    expect(payload.event).toBe("purchase_completed");
    expect(Object.keys(payload.properties).sort()).toEqual(["distinct_id", "$insert_id", "$process_person_profile", "plan_name"].sort());
    expect(payload.properties.$insert_id).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.properties.distinct_id).toBe(`purchase_${payload.properties.$insert_id}`);
    expect(payload.properties.$process_person_profile).toBe(false);
    expect(payload.properties.plan_name).toBe("PMLE Pass");
    expect(request[1].body).not.toContain("cs_test_opaque");
    expect(fetchMock.mock.calls[1][1].body).toBe(request[1].body);
    expect(request[1].cache).toBe("no-store");
  });
  it("cannot undo a grant when the analytics transport fails", async () => {
    fetchMock.mockRejectedValue(new Error("transport unavailable"));
    await expect(trackPurchaseCompleted("cs_test_opaque")).resolves.toBeUndefined();
  });
});

describe("server funnel analytics", () => {
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
  it("defers capture, uses bounded telemetry identity and falls back for invalid headers", async () => {
    scheduleFunnelEvent(new Request("http://localhost", { headers: { "X-PostHog-Distinct-Id": "browser_123" } }), "signup_completed", "user-id");
    expect(fetchMock).not.toHaveBeenCalled();
    await afterMock.mock.calls[0][0]();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties.distinct_id).toBe("browser_123");
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
