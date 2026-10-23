import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StripeService } from "@/lib/stripe/stripe-service";
import { fulfillCheckoutSession } from "@/lib/stripe/pmle-pass";
const mocks = vi.hoisted(() => ({ create: vi.fn(), after: vi.fn() }));
vi.mock("stripe", () => ({ default: class { checkout = { sessions: { create: mocks.create } }; } }));
vi.mock("next/server", () => ({ after: mocks.after }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const first = { utm_source: "google", utm_medium: "cpc", utm_campaign: "pmle", utm_content: "five", gclid: "Click_123" };
beforeEach(() => {
  mocks.create.mockReset().mockResolvedValue({ id: "cs_unit", url: "https://checkout.stripe.com/c/pay" }); mocks.after.mockReset();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit"); vi.stubEnv("STRIPE_PRICE_PMLE_PASS", "price_unit"); vi.stubEnv("TESTERO_LOCAL_STRIPE", undefined);
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "unit-public-placeholder");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("Stripe adapter re-allowlists metadata and cannot overwrite account/product identity", async () => {
  await new StripeService().createCheckoutSession({ customerId: "cus_unit", userId: user, successUrl: "https://testero.ai/checkout/success", cancelUrl: "https://testero.ai/pricing", idempotencyKey: "unit", analyticsMetadata: { ...first, analytics_enabled: "1", user_id: "victim", plan_name: "Wrong plan", email: "private@example.com", utm_term: "private" } });
  const [payload] = mocks.create.mock.calls[0];
  expect(payload.metadata).toEqual({ analytics_enabled: "1", ...first, user_id: user, plan_name: "PMLE Pass" });
  expect(payload.payment_intent_data.metadata).toEqual({ user_id: user, plan_name: "PMLE Pass" });
  expect(JSON.stringify(payload)).not.toMatch(/victim|Wrong plan|private|email/);
});
function fulfillment() {
  const metadata = { analytics_enabled: "1", ...first, user_id: user, plan_name: "PMLE Pass" };
  const session = { id: "cs_unit", mode: "payment", payment_status: "paid", metadata, payment_intent: "pi_unit", customer: "cus_unit", amount_total: 3900, currency: "usd", line_items: { has_more: false, data: [{ price: { id: "price_unit" }, quantity: 1 }] } } as unknown as Stripe.Checkout.Session;
  const pass = { id: "pass", user_id: user, stripe_payment_intent_id: "pi_unit", refunded_at: null };
  const db = { rpc: vi.fn((name: string) => name === "fulfill_pmle_pass" ? { single: async () => ({ data: pass, error: null }) } : Promise.resolve({ error: null })), from: vi.fn(() => query) };
  const query = { update: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query), select: vi.fn(() => query), maybeSingle: async () => ({ data: { id: pass.id }, error: null }) };
  const stripe = { retrievePaymentIntent: vi.fn().mockResolvedValue({ status: "succeeded", metadata: { user_id: user, plan_name: "PMLE Pass" }, latest_charge: { created: 1791000000, refunded: false, amount_refunded: 0 } }) };
  return { session, pass, db: db as unknown as SupabaseClient, stripe: stripe as unknown as StripeService };
}
it("fulfillment returns paid access before purchase telemetry starts and preserves durable checkout attribution", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetchMock);
  const f = fulfillment();
  expect((await fulfillCheckoutSession(f.stripe, f.db, f.session)).pass).toEqual(f.pass);
  expect(fetchMock).not.toHaveBeenCalled(); expect(mocks.after).toHaveBeenCalledOnce();
  await mocks.after.mock.calls[0][0]();
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.properties).toMatchObject({ ...first, distinct_id: user, source: "server", revenue: 39, currency: "USD" });
  expect(body.properties.$set_once.$initial_gclid).toBe(first.gclid);
  expect(body.$set_once).toBeUndefined(); // Public Capture API puts person mutations inside properties.
});
it("unavailable after context cannot undo paid fulfillment", async () => {
  mocks.after.mockImplementation(() => { throw new Error("no context"); });
  const f = fulfillment(); await expect(fulfillCheckoutSession(f.stripe, f.db, f.session)).resolves.toMatchObject({ pass: f.pass });
});
