import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackPurchaseCompleted } from "@/lib/analytics/server";
const fetchMock = vi.fn();
beforeEach(() => {
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
