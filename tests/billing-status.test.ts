import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/billing/status/route";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { getVerifiedUser } from "@/lib/auth/session";
const m = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/lib/billing/paid-access", async original => ({ ...await original<typeof import("@/lib/billing/paid-access")>(), getPaidAccess: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => m }));
function req(query = "session_id=cs_test_owned") { return new Request(`http://localhost:3000/api/billing/status?${query}`); }
const passId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const paidAt = "2020-01-01T00:00:00Z";
beforeEach(() => { vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: true, isLegacySubscriber: false, accessUntil: null, pass: null }); vi.mocked(getVerifiedUser).mockResolvedValue({ id: "user", email_confirmed_at: "confirmed" } as never); m.from.mockReturnValue(m); m.select.mockReturnValue(m); m.eq.mockReturnValue(m); m.maybeSingle.mockResolvedValue({ data: null, error: null }); });
describe("owned read-only checkout status", () => {
  it("requires auth before parsing untrusted session id", async () => { vi.mocked(getVerifiedUser).mockResolvedValue(null); const r = await GET(req("")); expect(r.status).toBe(401); expect(m.from).not.toHaveBeenCalled(); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
  it.each(["", "session_id=bad", "session_id=cs_a&session_id=cs_b", "session_id=cs_%3Cscript%3E", `session_id=cs_${"a".repeat(241)}`])("rejects missing, ambiguous, or malformed id %s", async query => { expect((await GET(req(query))).status).toBe(400); expect(m.from).not.toHaveBeenCalled(); });
  it("returns processing for unknown or not-owned without any Stripe call/grant", async () => { const r = await GET(req()); expect(await r.json()).toEqual({ status: "processing", accessUntil: null }); expect(m.from).toHaveBeenCalledExactlyOnceWith("pmle_passes"); expect(m.select).toHaveBeenCalledWith("id, paid_at, expires_at, refunded_at"); expect(m.eq).toHaveBeenCalledWith("user_id", "user"); expect(m.eq).toHaveBeenCalledWith("stripe_checkout_session_id", "cs_test_owned"); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
  it.each([ ["active", "2099-01-01T00:00:00Z", null], ["expired", "2020-01-02T00:00:00Z", null], ["refunded", "2099-01-01T00:00:00Z", "2026-01-01T00:00:00Z"] ])("reports %s from durable owned pass row", async (status, expires_at, refunded_at) => { m.maybeSingle.mockResolvedValue({ data: { id: passId, paid_at: paidAt, expires_at, refunded_at }, error: null }); expect(await (await GET(req())).json()).toEqual({ status, accessUntil: expires_at }); });
  it("fails closed before reporting any owned active pass when either access source fails", async () => { vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null, unavailable: true }); m.maybeSingle.mockResolvedValue({ data: { id: passId, paid_at: paidAt, expires_at: "2099-01-01T00:00:00Z", refunded_at: null }, error: null }); const r = await GET(req()); expect(r.status).toBe(503); expect(m.from).not.toHaveBeenCalled(); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
  it.each(["legacy", "passes"])("real shared access checker returns 503 on %s DB read failure", async source => {
    const actual = await vi.importActual<typeof import("@/lib/billing/paid-access")>("@/lib/billing/paid-access");
    vi.mocked(getPaidAccess).mockImplementationOnce(actual.getPaidAccess);
    vi.mocked(getVerifiedUser).mockResolvedValue({ id: passId, email_confirmed_at: "confirmed" } as never);
    const legacy = { select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() };
    legacy.select.mockReturnValue(legacy); legacy.eq.mockReturnValue(legacy); legacy.limit.mockReturnValue(legacy);
    legacy.maybeSingle.mockResolvedValue({ data: { status: "active", current_period_end: null }, error: source === "legacy" ? { message: "DB failure" } : null });
    const passes = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    passes.select.mockReturnValue(passes); passes.eq.mockReturnValue(passes);
    passes.order.mockResolvedValue({ data: [{ id: passId, paid_at: paidAt, expires_at: "2099-01-01T00:00:00Z", refunded_at: null }], error: source === "passes" ? { message: "DB failure" } : null });
    m.from.mockImplementation(table => table === "user_subscriptions" ? legacy : passes);
    const r = await GET(req()); expect(r.status).toBe(503); expect(m.from).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(await r.json())).not.toContain("DB failure");
  });
  it("does not call a future-paid row active even with other legacy/pass access", async () => { m.maybeSingle.mockResolvedValue({ data: { id: passId, paid_at: "2098-01-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z", refunded_at: null }, error: null }); expect(await (await GET(req())).json()).toEqual({ status: "expired", accessUntil: "2099-01-01T00:00:00Z" }); });
  it("never treats global paid access as proof that a different checkout row exists", async () => { expect(await (await GET(req())).json()).toEqual({ status: "processing", accessUntil: null }); expect(getPaidAccess).toHaveBeenCalledWith("user", m, expect.any(Number)); });
  it.each([{ data: null, error: { message: "private DB" } }, { data: { expires_at: "broken", refunded_at: null }, error: null }])("returns 503 instead of false processing on DB failure %#", async result => { vi.spyOn(console, "error").mockImplementation(() => {}); m.maybeSingle.mockResolvedValue(result); const r = await GET(req()); expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("private DB"); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
});
