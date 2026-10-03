import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/billing/portal/route";
import { getVerifiedUser } from "@/lib/auth/session";
import { getPaidAccess } from "@/lib/billing/paid-access";
const m = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), ctor: vi.fn(), portal: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => m }));
vi.mock("@/lib/stripe/stripe-service", () => ({ StripeService: class { constructor() { m.ctor(); } createPortalSession = m.portal; } }));
function req(body: unknown = {}, origin = "http://localhost:3000") { return new Request("http://localhost:3000/api/billing/portal", { method: "POST", headers: { origin }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.mocked(getVerifiedUser).mockResolvedValue({ id: "user", email_confirmed_at: "confirmed" } as never); vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: true, isLegacySubscriber: true, accessUntil: null, pass: null }); m.from.mockReturnValue(m); m.select.mockReturnValue(m); m.eq.mockReturnValue(m); m.limit.mockReturnValue(m); m.maybeSingle.mockResolvedValue({ data: { stripe_customer_id: "cus_owned" }, error: null }); m.portal.mockResolvedValue({ url: "https://billing.stripe.com/session" }); });
describe("legacy portal", () => {
  it("uses fresh active legacy entitlement and owned server customer", async () => { const r = await POST(req()); expect(r.status).toBe(200); expect(await r.json()).toEqual({ href: "https://billing.stripe.com/session" }); expect(m.eq).toHaveBeenCalledWith("user_id", "user"); expect(m.eq).toHaveBeenCalledWith("status", "active"); expect(m.portal).toHaveBeenCalledWith("cus_owned", "http://localhost:3000/account"); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
  it("uses browser HTTPS Host rather than internal Cloud Run HTTP origin", async () => { const r = await POST(new Request("http://localhost:8080/api/billing/portal", { method: "POST", headers: { host: "testero.ai", origin: "https://testero.ai", "x-forwarded-proto": "https" }, body: "{}" })); expect(r.status).toBe(200); expect(m.portal).toHaveBeenCalledWith("cus_owned", "https://testero.ai/account"); });
  it.each([false, true])("denies nonlegacy access even with pass paid=%s", async paid => { vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: paid, isLegacySubscriber: false, accessUntil: null, pass: null }); expect((await POST(req())).status).toBe(403); expect(m.ctor).not.toHaveBeenCalled(); });
  it("fails closed when either entitlement source fails", async () => { vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null, unavailable: true }); expect((await POST(req())).status).toBe(503); expect(m.ctor).not.toHaveBeenCalled(); });
  it("never uses an unverified user", async () => { vi.mocked(getVerifiedUser).mockResolvedValue(null); expect((await POST(req())).status).toBe(401); expect(getPaidAccess).not.toHaveBeenCalled(); expect(m.ctor).not.toHaveBeenCalled(); });
  it("rejects cross origin before identity", async () => { expect((await POST(req({}, "https://evil.example"))).status).toBe(403); expect(getVerifiedUser).not.toHaveBeenCalled(); });
  it.each([{ customerId: "victim" }, { returnUrl: "https://evil.example" }, [], null])("rejects client billing inputs %#", async body => { expect((await POST(req(body))).status).toBe(400); expect(getPaidAccess).not.toHaveBeenCalled(); });
  it.each([{ data: null, error: null }, { data: null, error: { message: "secret" } }])("cannot open a portal without a confirmed owned customer %#", async result => { vi.spyOn(console, "error").mockImplementation(() => {}); m.maybeSingle.mockResolvedValue(result); expect((await POST(req())).status).toBe(503); expect(m.ctor).not.toHaveBeenCalled(); });
});
