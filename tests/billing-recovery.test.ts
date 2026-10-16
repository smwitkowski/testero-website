import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/billing/status/route";
import { POST } from "@/app/api/billing/webhook/route";
import { trackPurchaseCompleted } from "@/lib/analytics/server";
const m = vi.hoisted(() => ({ session: vi.fn(), intent: vi.fn(), construct: vi.fn(), pass: null as Record<string, unknown> | null, receipt: null as Record<string, unknown> | null, events: new Map<string, Record<string, unknown>>(), rpc: vi.fn(), receiptFailure: false, readFailure: false, claimFailure: false, failFreshAccess: false, grants: 0, refunded: false }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: async () => ({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }) }));
vi.mock("@/lib/stripe/stripe-service", () => ({ StripeService: class { retrieveCheckoutSession = m.session; retrievePaymentIntent = m.intent; constructWebhookEvent = m.construct; } }));
vi.mock("@/lib/analytics/server", () => ({ trackPurchaseCompleted: vi.fn() }));
vi.mock("@/lib/billing/paid-access", async original => ({ ...await original<typeof import("@/lib/billing/paid-access")>(), getPaidAccess: async () => ({ hasPaidAccess: !!m.pass && !m.pass.refunded_at, unavailable: m.readFailure || (m.failFreshAccess && !!m.pass) }) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => db }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const paidAt = Math.floor(Date.now() / 1000) - 3600;
function checkout(overrides: Record<string, unknown> = {}) {
  return { id: "cs_test_owned", mode: "payment", payment_status: "paid", metadata: { user_id: user, plan_name: "PMLE Pass" }, payment_intent: "pi_owned", customer: "cus_owned", line_items: { has_more: false, data: [{ price: { id: "price_pass" }, quantity: 1 }] }, amount_total: 3900, currency: "usd", ...overrides };
}
const db = {
  rpc: (...args: unknown[]) => m.rpc(...args),
  from(table: string) {
    let operation = "select"; let value: Record<string, unknown> = {}; const filters: [string, unknown][] = [];
    const builder = {
      select() { return builder; }, eq(key: string, val: unknown) { filters.push([key, val]); return builder; },
      is(key: string, val: unknown) { filters.push([key, val]); return builder; },
      update(val: Record<string, unknown>) { operation = "update"; value = val; return builder; },
      insert(val: Record<string, unknown>) { operation = "insert"; value = val; return builder; },
      single: async () => finish(), maybeSingle: async () => finish(),
      then(resolve: (result: unknown) => unknown) { return Promise.resolve(finish()).then(resolve); },
    };
    function finish() {
      let row = table === "pmle_passes" ? m.pass : table === "payment_history" ? m.receipt : m.events.get(String(filters.find(([key]) => key === "stripe_event_id")?.[1])) ?? null;
      if (operation === "insert") { m.events.set(String(value.stripe_event_id), { ...value }); return { error: null }; }
      if (row && !filters.every(([key, val]) => row![key] === val)) row = null;
      if (operation === "update" && table === "pmle_passes" && m.claimFailure) return { data: null, error: new Error("claim unavailable") };
      if (operation === "update" && row) Object.assign(row, value);
      return { data: row ? { ...row } : null, error: null };
    }
    return builder;
  },
};
function poll() { return GET(new Request("http://localhost/api/billing/status?session_id=cs_test_owned")); }
function webhook(type = "checkout.session.completed", id = "evt_complete") {
  m.construct.mockReturnValue({ id, type, created: paidAt + 30, data: { object: type === "charge.refunded" ? { payment_intent: "pi_owned" } : { id: "cs_test_owned" } } });
  return POST(new Request("http://localhost/api/billing/webhook", { method: "POST", headers: { "stripe-signature": "mock" }, body: "mock" }));
}
beforeEach(() => {
  vi.stubEnv("STRIPE_PRICE_PMLE_PASS", "price_pass"); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_mock");
  m.pass = null; m.receipt = null; m.events.clear(); m.grants = 0; m.refunded = false; m.receiptFailure = false; m.readFailure = false; m.claimFailure = false; m.failFreshAccess = false;
  m.session.mockResolvedValue(checkout());
  m.intent.mockImplementation(async () => ({ status: "succeeded", metadata: { user_id: user, plan_name: "PMLE Pass" }, latest_charge: { created: paidAt, refunded: m.refunded, amount_refunded: m.refunded ? 1 : 0 } }));
  m.rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    if (name === "fulfill_pmle_pass") return { single: async () => {
      if (!m.pass) { m.grants++; m.pass = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", user_id: user, stripe_checkout_session_id: "cs_test_owned", stripe_payment_intent_id: "pi_owned", paid_at: args.p_paid_at, expires_at: new Date((paidAt + 90 * 86400) * 1000).toISOString(), refunded_at: m.refunded ? new Date().toISOString() : null, purchase_completed_at: null }; }
      return { data: { ...m.pass }, error: null };
    } };
    if (name === "record_pmle_pass_payment") {
      if (m.receiptFailure) return Promise.resolve({ error: new Error("receipt unavailable") });
      m.receipt = { id: "receipt", user_id: user, stripe_payment_intent_id: "pi_owned", amount: args.p_amount, currency: args.p_currency, status: m.pass?.refunded_at ? "refunded" : "succeeded" };
    }
    if (name === "refund_pmle_pass") { m.refunded = true; if (m.pass) m.pass.refunded_at = args.p_refunded_at; if (m.receipt) m.receipt.status = "refunded"; }
    return Promise.resolve({ error: null });
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("shared fulfillment without webhook delivery", () => {
  it("grants on return once, skips Stripe on second poll, and late webhook changes no entitlement or analytics", async () => {
    expect((await (await poll()).json()).status).toBe("active");
    expect(m.grants).toBe(1); expect(m.receipt).toMatchObject({ amount: 3900, currency: "usd", status: "succeeded" });
    const original = { ...m.pass };
    expect((await (await poll()).json()).status).toBe("active");
    expect(m.session).toHaveBeenCalledTimes(1);
    expect((await webhook()).status).toBe(200);
    expect(m.grants).toBe(1); expect(m.pass).toEqual(original);
    expect(trackPurchaseCompleted).toHaveBeenCalledExactlyOnceWith("cs_test_owned");
  });
  it("webhook first makes return read-only", async () => {
    expect((await webhook()).status).toBe(200); expect((await (await poll()).json()).status).toBe("active");
    expect(m.session).toHaveBeenCalledTimes(1); expect(m.grants).toBe(1); expect(trackPurchaseCompleted).toHaveBeenCalledOnce();
  });
  it("parallel return and webhook share the atomic analytics claim", async () => {
    const results = await Promise.all([poll(), webhook(), poll(), webhook("checkout.session.async_payment_succeeded", "evt_async")]);
    expect(results.map(result => result.status)).toEqual([200, 200, 200, 200]);
    expect(m.grants).toBe(1); expect(trackPurchaseCompleted).toHaveBeenCalledOnce();
  });
  it.each([
    { metadata: { user_id: "another-user", plan_name: "PMLE Pass" } },
    { payment_status: "unpaid" },
    { line_items: { has_more: false, data: [{ price: { id: "price_other" }, quantity: 1 }] } },
  ])("never grants foreign, unpaid or other-price sessions %#", async change => {
    m.session.mockResolvedValue(checkout(change));
    expect(await (await poll()).json()).toEqual({ status: "processing", accessUntil: null });
    expect(m.session).toHaveBeenCalledTimes(1); expect(m.intent).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled(); expect(trackPurchaseCompleted).not.toHaveBeenCalled();
  });
  it("refund after return revokes pass and receipt and replay cannot restore either", async () => {
    await poll(); const original = { ...m.pass };
    expect((await webhook("charge.refunded", "evt_refund")).status).toBe(200);
    expect((await (await poll()).json()).status).toBe("refunded");
    expect((await webhook()).status).toBe(200);
    expect(m.pass).toMatchObject({ id: original.id, paid_at: original.paid_at, expires_at: original.expires_at, refunded_at: expect.any(String) });
    expect(m.receipt?.status).toBe("refunded"); expect(m.grants).toBe(1); expect(trackPurchaseCompleted).toHaveBeenCalledOnce();
  });
  it("repairs a receipt failure after committed grant on the next poll", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); m.receiptFailure = true;
    expect((await poll()).status).toBe(503); expect(m.grants).toBe(1); expect(trackPurchaseCompleted).not.toHaveBeenCalled();
    m.receiptFailure = false; expect((await (await poll()).json()).status).toBe("active");
    expect(m.grants).toBe(1); expect(m.receipt?.status).toBe("succeeded"); expect(trackPurchaseCompleted).toHaveBeenCalledOnce();
  });
  it("retries a failed analytics claim without double-granting", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); m.claimFailure = true;
    expect((await poll()).status).toBe(503); expect(m.grants).toBe(1); expect(trackPurchaseCompleted).not.toHaveBeenCalled();
    m.claimFailure = false; expect((await (await poll()).json()).status).toBe("active");
    expect(m.grants).toBe(1); expect(trackPurchaseCompleted).toHaveBeenCalledOnce();
  });
  it("fails closed on Stripe identity or retrieval errors without grants", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); m.session.mockResolvedValueOnce(checkout({ id: "cs_wrong" }));
    expect((await poll()).status).toBe(503); m.session.mockRejectedValueOnce(new Error("private Stripe"));
    expect((await poll()).status).toBe(503); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rechecks access after fulfillment and fails closed if fresh verification fails", async () => {
    m.failFreshAccess = true;
    expect((await poll()).status).toBe(503); expect(m.grants).toBe(1);
  });
});
