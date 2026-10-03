import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, checkoutIdempotencyKey } from "@/app/api/billing/checkout/route";
import { getVerifiedUser } from "@/lib/auth/session";
import { getPaidAccess } from "@/lib/billing/paid-access";
const mocks = vi.hoisted(() => ({ db: {}, ctor: vi.fn(), customer: vi.fn(), checkout: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => mocks.db) }));
vi.mock("@/lib/stripe/stripe-service", () => ({ StripeService: class { constructor() { mocks.ctor(); } createOrRetrieveCustomer = mocks.customer; createCheckoutSession = mocks.checkout; } }));
const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email_confirmed_at: "2026-10-03" };
function req(body: unknown = {}, origin = "http://localhost:3000") { return new Request("http://localhost:3000/api/billing/checkout", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => {
  vi.stubEnv("STRIPE_PRICE_PMLE_PASS", "price_pass");
  vi.mocked(getVerifiedUser).mockResolvedValue(user as never);
  vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null });
  mocks.customer.mockResolvedValue({ id: "cus_owned" }); mocks.checkout.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay" });
});
describe("PMLE checkout", () => {
  it("creates only server price for confirmed identity and bounded idempotency", async () => {
    const response = await POST(req()); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ href: "https://checkout.stripe.com/c/pay" });
    expect(getPaidAccess).toHaveBeenCalledWith(user.id, mocks.db); expect(mocks.customer).toHaveBeenCalledWith(user.id);
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ customerId: "cus_owned", userId: user.id, successUrl: "http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}", cancelUrl: "http://localhost:3000/pricing", idempotencyKey: expect.stringMatching(/^pmle-pass:[a-f0-9]{64}$/) }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const k = checkoutIdempotencyKey(user.id, "price_pass", 600_001);
    expect(k).toBe(checkoutIdempotencyKey(user.id, "price_pass", 1_199_999));
    expect(k).not.toBe(checkoutIdempotencyKey(user.id, "price_other", 600_001)); expect(k).not.toBe(checkoutIdempotencyKey("other", "price_pass", 600_001)); expect(k).not.toBe(checkoutIdempotencyKey(user.id, "price_pass", 1_200_000));
  });
  it("preserves the browser origin when Next uses an internal localhost URL", async () => { const request = new Request("http://localhost:3000/api/billing/checkout", { method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }, body: "{}" }); expect((await POST(request)).status).toBe(200); expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ successUrl: "http://127.0.0.1:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}", cancelUrl: "http://127.0.0.1:3000/pricing" })); });
  it("rejects cross origin before auth or Stripe", async () => { expect((await POST(req({}, "https://evil.example"))).status).toBe(403); expect(getVerifiedUser).not.toHaveBeenCalled(); expect(mocks.ctor).not.toHaveBeenCalled(); });
  it("requires verified confirmed identity", async () => { vi.mocked(getVerifiedUser).mockResolvedValue(null); const r = await POST(req()); expect(r.status).toBe(401); expect(getPaidAccess).not.toHaveBeenCalled(); expect(mocks.ctor).not.toHaveBeenCalled(); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
  it.each([null, [], { priceId: "price_other" }, { userId: "victim" }, { mode: "subscription" }, { returnUrl: "https://evil.example" }])("rejects nonempty or invalid body %#", async body => { expect((await POST(req(body))).status).toBe(400); expect(getPaidAccess).not.toHaveBeenCalled(); expect(mocks.ctor).not.toHaveBeenCalled(); });
  it.each([false, true])("does not charge existing paid users (legacy=%s)", async legacy => { vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: true, isLegacySubscriber: legacy, accessUntil: "2027-01-01", pass: null }); const r = await POST(req()); expect(await r.json()).toEqual({ href: "/account", alreadyActive: true }); expect(mocks.ctor).not.toHaveBeenCalled(); });
  it("never charges after an entitlement DB failure", async () => { vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null, unavailable: true }); const r = await POST(req()); expect(r.status).toBe(503); expect(mocks.ctor).not.toHaveBeenCalled(); });
  it("requires configured server price and sanitizes provider errors", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); vi.stubEnv("STRIPE_PRICE_PMLE_PASS", ""); expect((await POST(req())).status).toBe(503); expect(mocks.ctor).not.toHaveBeenCalled(); vi.stubEnv("STRIPE_PRICE_PMLE_PASS", "price_pass"); mocks.checkout.mockRejectedValue(new Error("secret/customer/email")); const r = await POST(req()); expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("secret"); });
});
