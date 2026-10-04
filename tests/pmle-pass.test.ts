import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StripeService } from "@/lib/stripe/stripe-service";
import { grantPmlePass, isPaidPassSession, refundPmlePass, stripeId, PASS_DURATION_MS } from "@/lib/stripe/pmle-pass";
import { trackPurchaseCompleted } from "@/lib/analytics/server";
const m = vi.hoisted(() => ({ constructor: vi.fn(), search: vi.fn(), customerCreate: vi.fn(), checkoutCreate: vi.fn(), checkoutRetrieve: vi.fn(), intentRetrieve: vi.fn(), portalCreate: vi.fn(), subscriptionRetrieve: vi.fn(), construct: vi.fn() }));
vi.mock("stripe", () => ({ default: class { constructor(...args: unknown[]) { m.constructor(...args); } customers = { search: m.search, create: m.customerCreate }; checkout = { sessions: { create: m.checkoutCreate, retrieve: m.checkoutRetrieve } }; paymentIntents = { retrieve: m.intentRetrieve }; billingPortal = { sessions: { create: m.portalCreate } }; subscriptions = { retrieve: m.subscriptionRetrieve }; webhooks = { constructEvent: m.construct }; } }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function session(overrides: Record<string, unknown> = {}) { return { id: "cs_test_pass", mode: "payment", payment_status: "paid", metadata: { user_id: user, plan_name: "PMLE Pass" }, customer: "cus_pass", payment_intent: "pi_pass", line_items: { has_more: false, data: [{ price: { id: "price_pass" }, quantity: 1 }] }, ...overrides } as unknown as Stripe.Checkout.Session; }
function intent(refunded = false) { return { status: "succeeded", metadata: { user_id: user, plan_name: "PMLE Pass" }, latest_charge: { id: "ch_pass", created: 1_791_000_000, refunded, amount_refunded: refunded ? 1 : 0 } }; }
function dbMock() {
  const single = vi.fn().mockResolvedValue({ data: { id: "pass", user_id: user, stripe_payment_intent_id: "pi_pass", refunded_at: null }, error: null });
  const rpc = vi.fn((name: string) => name === "fulfill_pmle_pass" ? { single } : Promise.resolve({ error: null }));
  return { single, rpc, db: { rpc } as unknown as SupabaseClient };
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock_never_network");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_mock");
  vi.stubEnv("STRIPE_PRICE_PMLE_PASS", "price_pass");
  vi.stubEnv("TESTERO_LOCAL_STRIPE", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "http://127.0.0.1:56546");
  m.intentRetrieve.mockReset().mockResolvedValue(intent());
  m.checkoutCreate.mockReset().mockResolvedValue({ id: "cs_test_created", url: "https://checkout.stripe.com/c/test" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("reviewed PMLE pass fulfillment port", () => {
  it("keeps duration and Stripe id handling", () => { expect(PASS_DURATION_MS).toBe(90 * 24 * 60 * 60 * 1000); expect(stripeId("pi_1")).toBe("pi_1"); expect(stripeId({ id: "pi_1" })).toBe("pi_1"); expect(stripeId(null)).toBeNull(); });
  it("uses actual server price and complete line items, never totals or metadata alone", () => {
    expect(isPaidPassSession(session())).toBe(true);
    for (const change of [ { mode: "subscription" }, { payment_status: "unpaid" }, { metadata: { user_id: user, plan_name: "Other" } }, { payment_intent: null }, { customer: null }, { line_items: undefined }, { line_items: { has_more: true, data: [{ price: { id: "price_pass" }, quantity: 1 }] } }, { line_items: { has_more: false, data: [{ price: { id: "price_wrong" }, quantity: 1 }] } }, { line_items: { has_more: false, data: [{ price: { id: "price_pass" }, quantity: 2 }] } } ]) expect(isPaidPassSession(session(change))).toBe(false);
    vi.stubEnv("STRIPE_PRICE_PMLE_PASS", ""); expect(isPaidPassSession(session())).toBe(false);
  });
  it("finishes two current payment reads before publishing the database RPC", async () => {
    const mdb = dbMock(); const service = new StripeService(); await grantPmlePass(service, mdb.db, session());
    expect(m.intentRetrieve).toHaveBeenCalledTimes(2); expect(m.intentRetrieve).toHaveBeenCalledWith("pi_pass", { expand: ["latest_charge"] });
    expect(m.intentRetrieve.mock.invocationCallOrder[1]).toBeLessThan(mdb.rpc.mock.invocationCallOrder[0]);
    expect(mdb.rpc).toHaveBeenCalledWith("fulfill_pmle_pass", { p_user_id: user, p_stripe_checkout_session_id: "cs_test_pass", p_stripe_payment_intent_id: "pi_pass", p_stripe_customer_id: "cus_pass", p_paid_at: new Date(1_791_000_000 * 1000).toISOString() });
  });
  it.each([1, 2])("fails closed if current payment read %s fails", async read => {
    const mdb = dbMock(); m.intentRetrieve.mockReset(); if (read === 2) m.intentRetrieve.mockResolvedValueOnce(intent()); m.intentRetrieve.mockRejectedValueOnce(new Error("read failed"));
    await expect(grantPmlePass(new StripeService(), mdb.db, session())).rejects.toThrow("read failed"); expect(mdb.rpc).not.toHaveBeenCalled();
  });
  it.each([ { status: "processing" }, { metadata: { user_id: "victim", plan_name: "PMLE Pass" } }, { latest_charge: "ch_unexpanded" }, { latest_charge: { created: 0 } } ])("rejects bad current intent ownership/status/charge %#", async override => {
    const mdb = dbMock(); m.intentRetrieve.mockResolvedValue({ ...intent(), ...override }); await expect(grantPmlePass(new StripeService(), mdb.db, session())).rejects.toThrow(); expect(mdb.rpc).not.toHaveBeenCalled();
  });
  it("writes refund tombstone before fulfill when either read finds any refund", async () => {
    const mdb = dbMock(); m.intentRetrieve.mockResolvedValueOnce(intent()).mockResolvedValueOnce(intent(true));
    const result = await grantPmlePass(new StripeService(), mdb.db, session()); expect(result.refunded).toBe(true);
    expect(mdb.rpc.mock.calls.map(call => call[0])).toEqual(["refund_pmle_pass", "fulfill_pmle_pass"]);
  });
  it("preserves durable tombstone on replay even when current charge says unrefunded", async () => {
    const mdb = dbMock(); mdb.single.mockResolvedValue({ data: { id: "pass", user_id: user, stripe_payment_intent_id: "pi_pass", refunded_at: "2026-10-03" }, error: null });
    expect((await grantPmlePass(new StripeService(), mdb.db, session())).refunded).toBe(true);
  });
  it("rejects RPC errors or returned owner mismatches", async () => {
    const mdb = dbMock(); mdb.single.mockResolvedValueOnce({ data: null, error: { message: "DB failed" } } as never); await expect(grantPmlePass(new StripeService(), mdb.db, session())).rejects.toEqual({ message: "DB failed" });
    mdb.single.mockResolvedValueOnce({ data: { user_id: "victim", stripe_payment_intent_id: "pi_pass" }, error: null } as never); await expect(grantPmlePass(new StripeService(), mdb.db, session())).rejects.toThrow("ownership mismatch");
  });
  it("refund RPC is the only revocation write and propagates failure", async () => {
    const mdb = dbMock(); await refundPmlePass(mdb.db, "pi_pass", "2026-10-03T00:00:00Z"); expect(mdb.rpc).toHaveBeenCalledWith("refund_pmle_pass", { p_stripe_payment_intent_id: "pi_pass", p_refunded_at: "2026-10-03T00:00:00Z" });
    mdb.rpc.mockResolvedValueOnce({ error: { message: "DB failed" } } as never); await expect(refundPmlePass(mdb.db, "pi_pass", "2026-10-03")).rejects.toEqual({ message: "DB failed" });
  });
});
describe("minimal SDK adapter and fixture guard", () => {
  it("normal production uses SDK defaults", () => { vi.stubEnv("NODE_ENV", "production"); new StripeService(); expect(m.constructor).toHaveBeenCalledWith("sk_test_mock_never_network", { typescript: true }); });
  it("the valid fixture gate fixes loopback transport and cannot reach Stripe", () => { vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_testero_local_only"); vi.stubEnv("TESTERO_LOCAL_STRIPE", "1"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541"); new StripeService(); expect(m.constructor).toHaveBeenCalledWith("sk_test_testero_local_only", expect.objectContaining({ host: "127.0.0.1", port: 56545, protocol: "http", maxNetworkRetries: 0 })); });
  it.each([ { NODE_ENV: "production" }, { STRIPE_SECRET_KEY: "sk_live_wrong" }, { NEXT_PUBLIC_SUPABASE_URL: "https://remote.supabase.co" }, { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }, { TESTERO_LOCAL_STRIPE: "0" } ])("rejects invalid fixture configuration without SDK network fallback %#", override => { vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_testero_local_only"); vi.stubEnv("TESTERO_LOCAL_STRIPE", "1"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541"); Object.entries(override).forEach(([key, value]) => vi.stubEnv(key, value)); expect(() => new StripeService()).toThrow("Invalid local Stripe configuration"); expect(m.constructor).not.toHaveBeenCalled(); });
  it.each([ { STRIPE_SECRET_KEY: "sk_test_placeholder" }, { STRIPE_PRICE_PMLE_PASS: "price_testero_local_pmle" }, { STRIPE_WEBHOOK_SECRET: "whsec_testero_local_only" }, { STRIPE_WEBHOOK_SECRET: "whsec_testero_local_other" }, { STRIPE_WEBHOOK_SECRET: "whsec_placeholder" } ])("rejects known local placeholders outside fixture mode %#", override => { Object.entries(override).forEach(([key, value]) => vi.stubEnv(key, value)); expect(() => new StripeService()).toThrow("Local placeholder Stripe configuration is forbidden"); expect(m.constructor).not.toHaveBeenCalled(); });
  it("rejects local test secret without local flag", () => { vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_testero_local_only"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541"); expect(() => new StripeService()).toThrow("Invalid local Stripe configuration"); });
  it("sends card-only payment, server price, metadata on both objects, and idempotency", async () => { await new StripeService().createCheckoutSession({ customerId: "cus_owned", userId: user, successUrl: "http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}", cancelUrl: "http://localhost:3000/pricing", idempotencyKey: "bounded" }); expect(m.checkoutCreate).toHaveBeenCalledWith({ customer: "cus_owned", mode: "payment", allowed_payment_method_types: ["card"], line_items: [{ price: "price_pass", quantity: 1 }], metadata: { user_id: user, plan_name: "PMLE Pass" }, payment_intent_data: { metadata: { user_id: user, plan_name: "PMLE Pass" } }, success_url: "http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}", cancel_url: "http://localhost:3000/pricing" }, { idempotencyKey: "bounded" }); });
  it("does not put email in customer metadata or payload", async () => { m.search.mockResolvedValue({ data: [] }); m.customerCreate.mockResolvedValue({ id: "cus_owned" }); await new StripeService().createOrRetrieveCustomer(user); expect(m.customerCreate).toHaveBeenCalledWith({ metadata: { supabase_user_id: user } }, { idempotencyKey: `pmle-customer:${user}` }); });
  it("requests full expanded checkout and verifies raw signature via SDK", async () => { const sdk = new StripeService(); await sdk.retrieveCheckoutSession("cs_test_pass"); expect(m.checkoutRetrieve).toHaveBeenCalledWith("cs_test_pass", { expand: ["customer", "line_items.data.price"] }); sdk.constructWebhookEvent("raw-body", "sig", "whsec_mock"); expect(m.construct).toHaveBeenCalledWith("raw-body", "sig", "whsec_mock"); });
  it("rejects unsafe hosted checkout and allows only exact same-app fixture URL", async () => { const args = { customerId: "cus_owned", userId: user, successUrl: "http://127.0.0.1:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}", cancelUrl: "http://127.0.0.1:3000/pricing", idempotencyKey: "bounded" }; m.checkoutCreate.mockResolvedValue({ id: "cs_test_local", url: "https://evil.example/c/pay" }); await expect(new StripeService().createCheckoutSession(args)).rejects.toThrow("Invalid checkout URL"); vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_testero_local_only"); vi.stubEnv("TESTERO_LOCAL_STRIPE", "1"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541"); m.checkoutCreate.mockResolvedValue({ id: "cs_test_local", url: "http://127.0.0.1:3000/checkout/success?session_id=cs_test_local" }); await expect(new StripeService().createCheckoutSession(args)).resolves.toMatchObject({ id: "cs_test_local" }); m.checkoutCreate.mockResolvedValue({ id: "cs_test_local", url: "http://127.0.0.1:3000/checkout/success?session_id=cs_other" }); await expect(new StripeService().createCheckoutSession(args)).rejects.toThrow("Invalid checkout URL"); });
});
describe("server purchase analytics without PII", () => {
  it("is disabled with no key and never uses network", async () => { const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); await trackPurchaseCompleted("cs_test_opaque"); expect(fetchMock).not.toHaveBeenCalled(); });
  it("sends stable opaque distinct/insert ids and no raw purchase/customer/user/email", async () => { vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "public_mock"); vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "http://analytics.local"); const fetchMock = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetchMock); await trackPurchaseCompleted("cs_test_opaque"); await trackPurchaseCompleted("cs_test_opaque"); const args = fetchMock.mock.calls[0]; expect(args[0]).toBe("http://analytics.local/capture/"); const body = JSON.parse(args[1].body); expect(body.event).toBe("purchase_completed"); expect(body.properties.distinct_id).toMatch(/^purchase_[a-f0-9]{64}$/); expect(body.properties.$insert_id).toMatch(/^[a-f0-9]{64}$/); expect(body.properties.$process_person_profile).toBe(false); expect(args[1].body).not.toContain("cs_test_opaque"); expect(args[1].body).toBe(fetchMock.mock.calls[1][1].body); expect(Object.keys(body.properties).sort()).toEqual(["$insert_id", "$process_person_profile", "distinct_id", "plan_name"]); });
  it("analytics timeout/failure does not fail the purchase", async () => { vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "public_mock"); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("analytics unavailable"))); await expect(trackPurchaseCompleted("cs_opaque")).resolves.toBeUndefined(); });
});
