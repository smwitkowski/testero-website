import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/billing/webhook/route";
import { fulfillCheckoutSession, refundPmlePass } from "@/lib/stripe/pmle-pass";
import { trackPurchaseCompleted } from "@/lib/analytics/server";
const m = vi.hoisted(() => ({ construct: vi.fn(), session: vi.fn(), ctor: vi.fn(), db: {} as unknown, calls: [] as { table: string; operation: string; value?: unknown; filters: unknown[] }[], results: {} as Record<string, unknown[]> }));
vi.mock("@/lib/stripe/stripe-service", () => ({ StripeService: class { constructor() { m.ctor(); } constructWebhookEvent = m.construct; retrieveCheckoutSession = m.session; } }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => m.db }));
vi.mock("@/lib/stripe/pmle-pass", async original => ({ ...await original<typeof import("@/lib/stripe/pmle-pass")>(), fulfillCheckoutSession: vi.fn(), refundPmlePass: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ trackPurchaseCompleted: vi.fn() }));
const ownedSession = { id: "cs_test_owned", mode: "payment", payment_status: "paid", metadata: { user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", plan_name: "PMLE Pass" }, payment_intent: "pi_owned", customer: "cus_owned", line_items: { has_more: false, data: [{ price: { id: "price_pass" }, quantity: 1 }] }, amount_total: 3900, currency: "usd" };
const checkoutEvent = { id: "evt_checkout", type: "checkout.session.completed", created: 1_791_000_000, data: { object: { id: "cs_test_owned" } } };
function req(signature: string | null = "signed_mock", body = "raw-body") { return new Request("http://localhost:3000/api/billing/webhook", { method: "POST", headers: signature ? { "stripe-signature": signature } : {}, body }); }
function result(table: string, op: string, value: unknown) { (m.results[`${table}:${op}`] ??= []).push(value); }
function makeDb() {
  return { rpc(name: string, args: unknown) {
    m.calls.push({ table: "rpc", operation: name, value: args, filters: [] });
    return Promise.resolve(m.results[`rpc:${name}`]?.shift() ?? { data: null, error: null });
  }, from(table: string) {
    let operation = "select"; let value: unknown; const filters: unknown[] = [];
    const builder = {
      select() { operation = "select"; return builder; }, insert(input: unknown) { operation = "insert"; value = input; return builder; }, update(input: unknown) { operation = "update"; value = input; return builder; }, upsert(input: unknown) { operation = "upsert"; value = input; return builder; },
      eq(column: string, input: unknown) { filters.push([column, input]); return builder; },
      maybeSingle() { return Promise.resolve(finish()); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(finish()).then(resolve); },
    };
    function finish() { m.calls.push({ table, operation, value, filters }); return m.results[`${table}:${operation}`]?.shift() ?? { data: null, error: null }; }
    return builder;
  } };
}
beforeEach(() => { vi.stubEnv("STRIPE_PRICE_PMLE_PASS", "price_pass"); vi.stubEnv("STRIPE_PRICE_PMLE_PASS_LEGACY", undefined); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_mock"); m.calls = []; m.results = {}; m.db = makeDb(); m.construct.mockReset().mockReturnValue(checkoutEvent); m.session.mockReset().mockResolvedValue(ownedSession); vi.mocked(fulfillCheckoutSession).mockReset().mockResolvedValue({ pass: {} as never, refunded: false }); vi.mocked(refundPmlePass).mockReset().mockResolvedValue(undefined); vi.mocked(trackPurchaseCompleted).mockReset().mockResolvedValue(undefined); });
afterEach(() => vi.unstubAllEnvs());
describe("signed replay-safe billing webhook", () => {
  it("requires raw SDK signature verification before all DB access", async () => { const missing = await POST(req(null)); expect(missing.status).toBe(400); expect(m.calls).toEqual([]); expect(m.ctor).not.toHaveBeenCalled(); m.construct.mockImplementation(() => { throw new Error("private raw error"); }); const invalid = await POST(req("bad", "{raw}")); expect(invalid.status).toBe(400); expect(await invalid.json()).toEqual({ error: "Invalid webhook signature" }); expect(m.construct).toHaveBeenCalledWith("{raw}", "bad", "whsec_mock"); expect(m.calls).toEqual([]); expect(invalid.headers.get("cache-control")).toBe("private, no-store"); });
  it("retrieves full checkout, grants by reviewed port, records writes before processed", async () => { const r = await POST(req()); expect(r.status).toBe(200); expect(m.session).toHaveBeenCalledWith("cs_test_owned"); expect(fulfillCheckoutSession).toHaveBeenCalledWith(expect.anything(), m.db, ownedSession); expect(m.calls.map(c => `${c.table}:${c.operation}`)).toEqual(["webhook_events:select", "webhook_events:insert", "webhook_events:update"]); expect(m.calls.at(-1)?.value).toMatchObject({ processed: true, error: null }); expect(m.calls.some(c => c.table === "payment_history")).toBe(false);  expect(r.headers.get("cache-control")).toBe("private, no-store"); });
  it("skips duplicate processed events before Stripe reads or new grants", async () => { result("webhook_events", "select", { data: { processed: true }, error: null }); expect((await POST(req())).status).toBe(200); expect(fulfillCheckoutSession).not.toHaveBeenCalled(); expect(m.session).not.toHaveBeenCalled(); expect(trackPurchaseCompleted).not.toHaveBeenCalled(); expect(m.calls).toHaveLength(1); });
  it("replays unprocessed event safely without reinserting the ledger", async () => { result("webhook_events", "select", { data: { processed: false }, error: null }); expect((await POST(req())).status).toBe(200); expect(fulfillCheckoutSession).toHaveBeenCalledOnce(); expect(m.calls.some(c => c.operation === "insert")).toBe(false); });
  it("allows duplicate ledger insert race but still fulfills through idempotent RPC", async () => { result("webhook_events", "insert", { error: { code: "23505" } }); expect((await POST(req())).status).toBe(200); expect(fulfillCheckoutSession).toHaveBeenCalledOnce(); });
  it.each([ { mode: "subscription" }, { payment_status: "unpaid" }, { metadata: { user_id: "victim", plan_name: "Other" } } ])("does not grant nonpass/unpaid checkout %#", async change => { m.session.mockResolvedValue({ ...ownedSession, ...change }); expect((await POST(req())).status).toBe(200); expect(fulfillCheckoutSession).not.toHaveBeenCalled(); expect(trackPurchaseCompleted).not.toHaveBeenCalled(); expect(m.calls.some(c => c.table === "payment_history" || c.table === "rpc")).toBe(false); });
  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("grants allowlisted legacy price from signed %s", async type => {
    vi.stubEnv("STRIPE_PRICE_PMLE_PASS_LEGACY", "price_old39,price_older");
    m.construct.mockReturnValue({ ...checkoutEvent, type });
    const legacy = { ...ownedSession, line_items: { has_more: false, data: [{ price: { id: "price_old39" }, quantity: 1 }] } };
    m.session.mockResolvedValue(legacy);
    expect((await POST(req())).status).toBe(200);
    expect(fulfillCheckoutSession).toHaveBeenCalledWith(expect.anything(), m.db, legacy);
    expect(m.calls.at(-1)?.value).toMatchObject({ processed: true });
  });
  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("reports unknown paid %s safely and leaves it retryable", async type => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    m.construct.mockReturnValue({ ...checkoutEvent, type });
    m.session.mockResolvedValue({ ...ownedSession, line_items: { has_more: false, data: [{ price: { id: "price_unknown" }, quantity: 1 }] } });
    const response = await POST(req());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Billing is unavailable. Please try again." });
    expect(report.mock.calls).toEqual([["Paid PMLE Pass price is not allowlisted"], ["Billing request failed"]]);
    expect(fulfillCheckoutSession).not.toHaveBeenCalled();
    expect(m.calls.at(-1)?.value).toEqual({ error: "Billing processing failed" });
    expect(m.calls.some(call => (call.value as { processed?: boolean })?.processed)).toBe(false);
  });
  it("keeps paid current-price events retryable when the legacy list is malformed", async () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STRIPE_PRICE_PMLE_PASS_LEGACY", "price_old39,");
    expect((await POST(req())).status).toBe(503);
    expect(report).toHaveBeenCalledWith("Invalid PMLE Pass price configuration");
    expect(fulfillCheckoutSession).not.toHaveBeenCalled();
    expect(m.calls.some(call => (call.value as { processed?: boolean })?.processed)).toBe(false);
  });
  it("rejects mismatched Stripe checkout identity", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); m.session.mockResolvedValue({ ...ownedSession, id: "cs_wrong" }); expect((await POST(req())).status).toBe(503); expect(fulfillCheckoutSession).not.toHaveBeenCalled(); expect(m.calls.some(c => (c.value as { processed?: boolean })?.processed)).toBe(false); });
  it.each(["lookup", "insert", "grant", "processed"])("keeps event unprocessed on durable failure: %s", async stage => { vi.spyOn(console, "error").mockImplementation(() => {}); const error = { message: "secret SDK/customer/email" }; if (stage === "lookup") result("webhook_events", "select", { data: null, error }); if (stage === "insert") result("webhook_events", "insert", { error }); if (stage === "grant") vi.mocked(fulfillCheckoutSession).mockRejectedValueOnce(error); if (stage === "processed") result("webhook_events", "update", { error }); const r = await POST(req()); expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("secret"); expect(trackPurchaseCompleted).not.toHaveBeenCalled(); expect(JSON.stringify(m.calls)).not.toContain("secret"); if (stage !== "processed") expect(m.calls.some(c => (c.value as { processed?: boolean })?.processed)).toBe(false); });
  it("refund-before-checkout and partial refunds always use durable refund RPC", async () => { m.construct.mockReturnValue({ id: "evt_refund", type: "charge.refunded", created: 1_791_000_000, data: { object: { id: "ch_owned", payment_intent: "pi_owned", refunded: false, amount_refunded: 1 } } }); expect((await POST(req())).status).toBe(200); expect(refundPmlePass).toHaveBeenCalledWith(m.db, "pi_owned", new Date(1_791_000_000 * 1000).toISOString()); expect(fulfillCheckoutSession).not.toHaveBeenCalled(); expect(trackPurchaseCompleted).not.toHaveBeenCalled(); expect(m.calls.some(c => c.table === "payment_history")).toBe(false); });
  it("a refund DB failure is retryable and never marks event processed", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); m.construct.mockReturnValue({ id: "evt_refund", type: "charge.refunded", created: 1_791_000_000, data: { object: { payment_intent: "pi_owned" } } }); vi.mocked(refundPmlePass).mockRejectedValue(new Error("failed")); expect((await POST(req())).status).toBe(503); expect(m.calls.some(c => (c.value as { processed?: boolean })?.processed)).toBe(false); });
  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "payment_intent.succeeded"])("marks unhandled %s processed without billing work", async type => {
    m.construct.mockReturnValue({ id: "evt_ignored", type, data: { object: {} } });
    expect((await POST(req())).status).toBe(200);
    expect(fulfillCheckoutSession).not.toHaveBeenCalled();
    expect(m.session).not.toHaveBeenCalled();
    expect(m.calls.map(call => call.table)).toEqual(["webhook_events", "webhook_events", "webhook_events"]);
    expect(m.calls.at(-1)?.value).toMatchObject({ processed: true });
  });
});
