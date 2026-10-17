import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cert-waitlist/route";
import { scheduleFunnelEvent } from "@/lib/analytics/server";
import { allowWaitlistRequest } from "@/lib/certifications/rate-limit";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
const mocks = vi.hoisted(() => ({ select: vi.fn(), upsert: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => ({ from: mocks.from })) }));
vi.mock("@/lib/analytics/server", () => ({ scheduleFunnelEvent: vi.fn() }));
vi.mock("@/lib/certifications/rate-limit", () => ({ allowWaitlistRequest: vi.fn(() => true) }));
const valid = { email: " Person@Example.com ", cert_id: "cloud-engineer", website: "", source_path: "/certifications/cloud-engineer", utm_source: "test" };
const req = (data: unknown, origin = "http://localhost") => new Request("http://localhost/api/cert-waitlist", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(data) });
beforeEach(() => {
  mocks.from.mockReturnValue({ upsert: mocks.upsert }); mocks.upsert.mockReturnValue({ select: mocks.select });
  mocks.select.mockResolvedValue({ data: [{ id: "opaque-row" }], error: null });
  vi.mocked(allowWaitlistRequest).mockReturnValue(true);
});
describe("certification launch notifications", () => {
  it.each([{ ...valid, email: "bad" }, { ...valid, cert_id: "unknown" }, { ...valid, cert_id: "machine-learning-engineer" }, { ...valid, userId: "victim" }, { ...valid, source_path: "//evil.example" }])("rejects invalid input before persistence %#", async data => {
    expect((await POST(req(data))).status).toBe(400); expect(createServiceSupabaseClient).not.toHaveBeenCalled();
  });
  it("normalizes once, stores only allowed fields and emits no email", async () => {
    const response = await POST(req(valid));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ message: "You're on the list" });
    expect(mocks.from).toHaveBeenCalledWith("cert_waitlist");
    expect(mocks.upsert).toHaveBeenCalledWith({ email: "person@example.com", cert_id: "cloud-engineer", source_path: valid.source_path, utm_source: "test" }, { onConflict: "email,cert_id", ignoreDuplicates: true });
    expect(scheduleFunnelEvent).toHaveBeenCalledWith(expect.any(Request), "cert_waitlist_joined", expect.any(String), { cert_id: "cloud-engineer" });
    expect(JSON.stringify(vi.mocked(scheduleFunnelEvent).mock.calls)).not.toContain("person@example.com");
  });
  it("duplicates return identical success and do not emit another unique-interest event", async () => {
    const fresh = await POST(req(valid));
    vi.mocked(scheduleFunnelEvent).mockClear(); mocks.select.mockResolvedValue({ data: [], error: null });
    const duplicate = await POST(req(valid));
    expect(duplicate.status).toBe(fresh.status); expect(await duplicate.text()).toBe(await fresh.text());
    expect(scheduleFunnelEvent).not.toHaveBeenCalled();
  });
  it("honeypot succeeds without storage or analytics", async () => {
    expect((await POST(req({ ...valid, website: "spam" }))).status).toBe(200);
    expect(mocks.from).not.toHaveBeenCalled(); expect(scheduleFunnelEvent).not.toHaveBeenCalled();
  });
  it("rejects foreign origin, malformed and oversized bodies", async () => {
    expect((await POST(req(valid, "https://evil.example"))).status).toBe(403);
    for (const body of ["{", "x".repeat(4097)]) expect((await POST(new Request("http://localhost/api/cert-waitlist", { method: "POST", body }))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("limits attempts and hides storage failures", async () => {
    vi.mocked(allowWaitlistRequest).mockReturnValue(false);
    const limited = await POST(req(valid)); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("60");
    expect(mocks.from).not.toHaveBeenCalled(); vi.mocked(allowWaitlistRequest).mockReturnValue(true);
    mocks.select.mockResolvedValue({ data: null, error: { message: "private email" } });
    const response = await POST(req(valid)); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private email");
    expect(scheduleFunnelEvent).not.toHaveBeenCalled();
  });
});
