import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { POST, checkoutIdempotencyKey } from "@/app/api/billing/checkout/route";
import { StripeService } from "@/lib/stripe/stripe-service";
import { getVerifiedUser } from "@/lib/auth/session";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { scheduleFunnelEvent } from "@/lib/analytics/server";

const sdk = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), search: vi.fn() }));
vi.mock("stripe", async importOriginal => {
  const actual = await importOriginal<typeof import("stripe")>();
  return { default: class {
    static errors = actual.default.errors;
    customers = { search: sdk.search };
    checkout = { sessions: { create: sdk.create, list: sdk.list } };
  } };
});
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => ({})) }));
vi.mock("@/lib/analytics/server", () => ({ scheduleFunnelEvent: vi.fn() }));

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = 1_791_000_123_456;
const windowStart = Math.floor(now / 600_000) * 600;
const args = {
  customerId: "cus_owned", userId,
  successUrl: "http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "http://localhost:3000/pricing",
  idempotencyKey: checkoutIdempotencyKey(userId, "price_pass", now),
  idempotencyWindowStart: windowStart,
};
function openSession(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_first", customer: "cus_owned", metadata: { user_id: userId, plan_name: "PMLE Pass" },
    mode: "payment", status: "open", payment_status: "unpaid", created: Math.floor(now / 1000),
    line_items: { has_more: false, data: [{ price: { id: "price_pass" }, quantity: 1 }] },
    url: "https://checkout.stripe.com/c/first", ...overrides,
  } as unknown as Stripe.Checkout.Session;
}
function request(source: string, extraCookies = "") {
  return new Request("http://localhost:3000/api/billing/checkout", {
    method: "POST", body: "{}", headers: {
      origin: "http://localhost:3000", "content-type": "application/json",
      cookie: `testero_first_touch=${encodeURIComponent(JSON.stringify({ utm_source: source, utm_campaign: "pmle" }))}${extraCookies}`,
    },
  });
}
function conflict() { return new Stripe.errors.StripeIdempotencyError({ message: "Parameters differ for this idempotency key" }); }
beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit");
  vi.stubEnv("STRIPE_PRICE_PMLE_PASS", "price_pass");
  vi.stubEnv("TESTERO_LOCAL_STRIPE", undefined);
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "unit-public-placeholder");
  vi.spyOn(Date, "now").mockReturnValue(now);
  sdk.create.mockReset(); sdk.list.mockReset(); sdk.search.mockReset();
  sdk.search.mockResolvedValue({ data: [{ id: "cus_owned", metadata: { supabase_user_id: userId } }] });
  vi.mocked(getVerifiedUser).mockResolvedValue({ id: userId, email_confirmed_at: "2026-10-03" } as never);
  vi.mocked(getPaidAccess).mockResolvedValue({ hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null });
});
afterEach(() => vi.unstubAllEnvs());

/** Model Stripe's parameter-sensitive idempotency, not an always-successful helper. */
function stripeSimulation() {
  const physicalSessions: Stripe.Checkout.Session[] = [];
  const keys = new Map<string, { payload: string; session: Stripe.Checkout.Session }>();
  const conflicts: Error[] = [];
  sdk.create.mockImplementation(async (payload: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) => {
    const key = options.idempotencyKey!;
    const previous = keys.get(key);
    if (previous) {
      if (previous.payload !== JSON.stringify(payload)) {
        const error = conflict(); conflicts.push(error); throw error;
      }
      return previous.session;
    }
    const session = openSession({
      id: `cs_${physicalSessions.length + 1}`, customer: payload.customer,
      metadata: structuredClone(payload.metadata),
      line_items: { has_more: false, data: payload.line_items!.map(item => ({ price: { id: item.price }, quantity: item.quantity })) },
    });
    physicalSessions.push(session);
    keys.set(key, { payload: JSON.stringify(payload), session });
    return session;
  });
  sdk.list.mockImplementation(async () => ({ data: physicalSessions, has_more: false }));
  return { physicalSessions, conflicts };
}

describe("route and Stripe SDK idempotency together", () => {
  it.each(["", "; testero_internal=1"])("reuses one payable session across different attribution cookies (exclusion=%s)", async extraCookies => {
    const { physicalSessions, conflicts } = stripeSimulation();
    const firstResponse = await POST(request("google"));
    const secondResponse = await POST(request("reddit", extraCookies));
    expect(firstResponse.status).toBe(200); expect(secondResponse.status).toBe(200);
    expect(await firstResponse.json()).toEqual({ href: "https://checkout.stripe.com/c/first" });
    expect(await secondResponse.json()).toEqual({ href: "https://checkout.stripe.com/c/first" });
    expect(sdk.create).toHaveBeenCalledTimes(2); // Two API attempts, only one created resource.
    expect(physicalSessions).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toBeInstanceOf(Stripe.errors.StripeIdempotencyError);
    expect(sdk.create.mock.calls.map(call => call[1].idempotencyKey)).toEqual([args.idempotencyKey, args.idempotencyKey]);
    expect(physicalSessions[0].metadata).toEqual({ analytics_enabled: "1", utm_source: "google", utm_campaign: "pmle", user_id: userId, plan_name: "PMLE Pass" });
    expect(sdk.create.mock.calls[1][0].metadata).toMatchObject(extraCookies ? { analytics_enabled: "0" } : { utm_source: "reddit" });
    expect(sdk.list).toHaveBeenCalledExactlyOnceWith({
      customer: "cus_owned", status: "open", limit: 100,
      created: { gte: windowStart, lt: windowStart + 600 }, expand: ["data.line_items.data.price"],
    });
    const eventKeys = vi.mocked(scheduleFunnelEvent).mock.calls.map(call => call[4]);
    expect(eventKeys).toHaveLength(2); expect(eventKeys[0]).toBe(eventKeys[1]);
  });
  it("lets Stripe replay identical requests without listing or creating another resource", async () => {
    const { physicalSessions, conflicts } = stripeSimulation();
    const first = await POST(request("google")); const replay = await POST(request("google"));
    expect(first.status).toBe(200); expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(physicalSessions).toHaveLength(1); expect(conflicts).toHaveLength(0);
    expect(sdk.create).toHaveBeenCalledTimes(2); expect(sdk.list).not.toHaveBeenCalled();
  });
  it("keeps the original window if time crosses a boundary before conflict recovery", async () => {
    const { physicalSessions } = stripeSimulation();
    await POST(request("google"));
    sdk.create.mockImplementationOnce(async () => {
      vi.mocked(Date.now).mockReturnValue((windowStart + 600) * 1000);
      throw conflict();
    });
    const response = await POST(request("reddit"));
    expect(response.status).toBe(200); expect(physicalSessions).toHaveLength(1);
    expect(sdk.list).toHaveBeenLastCalledWith(expect.objectContaining({ created: { gte: windowStart, lt: windowStart + 600 } }));
  });
});

describe("conflict recovery fails closed", () => {
  it.each([
    { customer: "cus_other" }, { metadata: { user_id: "victim", plan_name: "PMLE Pass" } },
    { metadata: { user_id: userId, plan_name: "Other product" } }, { metadata: null },
    { mode: "subscription" }, { status: "complete" }, { status: "expired" }, { payment_status: "paid" },
    { created: windowStart - 1 }, { created: windowStart + 600 },
    { line_items: undefined }, { line_items: { has_more: true, data: [{ price: { id: "price_pass" }, quantity: 1 }] } },
    { line_items: { has_more: false, data: [{ price: { id: "price_other" }, quantity: 1 }] } },
    { line_items: { has_more: false, data: [{ price: { id: "price_pass" }, quantity: 2 }] } },
    { line_items: { has_more: false, data: [] } },
    { line_items: { has_more: false, data: [{ price: { id: "price_pass" }, quantity: 1 }, { price: { id: "price_pass" }, quantity: 1 }] } },
    { url: null }, { url: "not-a-url" }, { url: "http://checkout.stripe.com/c/pay" },
    { url: "https://checkout.stripe.com.evil.example/c/pay" }, { url: "https://evil.example/c/pay" },
  ])("does not reuse an unsafe/unrelated session %#", async override => {
    const error = conflict(); sdk.create.mockRejectedValue(error);
    sdk.list.mockResolvedValue({ data: [openSession(override)], has_more: false });
    await expect(new StripeService().createCheckoutSession(args)).rejects.toBe(error);
    expect(sdk.create).toHaveBeenCalledTimes(1); expect(sdk.list).toHaveBeenCalledTimes(1);
  });
  it("does not create again or emit checkout telemetry if recovery has no match", async () => {
    sdk.create.mockRejectedValue(conflict()); sdk.list.mockResolvedValue({ data: [], has_more: false });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request("google"));
    expect(response.status).toBe(503);
    expect(sdk.create).toHaveBeenCalledTimes(1); expect(sdk.list).toHaveBeenCalledTimes(1);
    expect(scheduleFunnelEvent).not.toHaveBeenCalled();
  });
  it("checks later pages without accepting an unsafe earlier session", async () => {
    sdk.create.mockRejectedValue(conflict());
    sdk.list.mockResolvedValueOnce({ data: [openSession({ id: "cs_stale", created: windowStart - 1 })], has_more: true })
      .mockResolvedValueOnce({ data: [openSession({ customer: { id: "cus_owned" } })], has_more: false });
    await expect(new StripeService().createCheckoutSession(args)).resolves.toMatchObject({ id: "cs_first" });
    expect(sdk.list).toHaveBeenCalledTimes(2);
    expect(sdk.list).toHaveBeenLastCalledWith(expect.objectContaining({ starting_after: "cs_stale" }));
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it.each([
    new Stripe.errors.StripeAPIError({ message: "Stripe unavailable" }),
    new Stripe.errors.StripeInvalidRequestError({ message: "Key in use", code: "idempotency_key_in_use" }),
    Object.assign(new Error("Not a real Stripe error"), { type: "StripeIdempotencyError" }),
  ])("does not swallow unrelated create errors %#", async error => {
    sdk.create.mockRejectedValue(error);
    await expect(new StripeService().createCheckoutSession(args)).rejects.toBe(error);
    expect(sdk.list).not.toHaveBeenCalled(); expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it("propagates lookup failures rather than retrying creation", async () => {
    const error = new Error("Lookup unavailable");
    sdk.create.mockRejectedValue(conflict()); sdk.list.mockRejectedValue(error);
    await expect(new StripeService().createCheckoutSession(args)).rejects.toBe(error);
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it.each(["cs_first", "cs_someone_else"])("uses the same exact-app URL rules in fixture mode (%s)", async sessionId => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_testero_local_only"); vi.stubEnv("TESTERO_LOCAL_STRIPE", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541");
    const error = conflict(); sdk.create.mockRejectedValue(error);
    sdk.list.mockResolvedValue({ data: [openSession({ url: `http://localhost:3000/checkout/success?session_id=${sessionId}` })], has_more: false });
    const result = new StripeService().createCheckoutSession(args);
    if (sessionId === "cs_first") await expect(result).resolves.toMatchObject({ id: "cs_first" });
    else await expect(result).rejects.toBe(error);
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
});
