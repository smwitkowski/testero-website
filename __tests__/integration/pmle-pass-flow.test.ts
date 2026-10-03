/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock("next/server", () => ({
  NextRequest: jest.fn().mockImplementation((url, init) => ({
    url,
    headers: { get: (name: string) => init?.headers?.[name] },
    text: async () => init?.body,
    json: async () => JSON.parse(init?.body),
  })),
  NextResponse: {
    json: (data: unknown, init: any) => ({ status: init?.status || 200, json: async () => data }),
    redirect: (url: string, init: any) => ({
      status: init?.status || 307,
      headers: { get: () => url },
    }),
  },
}));
jest.mock("stripe");
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/supabase/service");
jest.mock("@/lib/email/email-service", () => ({ EmailService: jest.fn(() => ({})) }));
jest.mock("posthog-node", () => ({
  PostHog: jest.fn(() => ({ capture: jest.fn(), identify: jest.fn() })),
}));
jest.mock("@/lib/auth/rate-limiter", () => ({ checkRateLimit: jest.fn(async () => true) }));
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as webhook } from "@/app/api/billing/webhook/route";
import { GET as success } from "@/app/api/billing/checkout/success/route";
import { PASS_DURATION_MS } from "@/lib/stripe/pmle-pass";
import { getPaidAccess } from "@/lib/billing/paid-access";

/** In-memory Stripe and SQL adapters. No service calls, including telemetry. */
describe("PMLE Pass lifecycle with mocked Stripe and database", () => {
  let rows: Record<string, any[]>;
  let writes: any[];
  let failTable: string | null;
  let session: any;
  let intent: any;
  let event: any;
  let sdk: any;
  let getUser: jest.Mock;
  let setCookie: jest.Mock;
  let beforeFulfill: (() => Promise<void>) | undefined;
  const db = {
    auth: { admin: { getUserById: jest.fn(async () => ({ data: null })) } },
    rpc: (name: string, args: any) => {
      const execute = async () => {
        if (name === "fulfill_pmle_pass") await beforeFulfill?.();
        writes.push({ table: "pmle_passes", action: "rpc", name, args });
        if (failTable === "pmle_passes") {
          failTable = null;
          return { data: null, error: { message: "RPC transaction failed" } };
        }
        const pi = args.p_stripe_payment_intent_id;
        if (name === "refund_pmle_pass") {
          let tombstone = rows.pmle_pass_refunds.find((row) => row.stripe_payment_intent_id === pi);
          if (!tombstone) {
            tombstone = { stripe_payment_intent_id: pi, refunded_at: args.p_refunded_at };
            rows.pmle_pass_refunds.push(tombstone);
          } else if (Date.parse(args.p_refunded_at) < Date.parse(tombstone.refunded_at))
            tombstone.refunded_at = args.p_refunded_at;
          rows.pmle_passes
            .filter((row) => row.stripe_payment_intent_id === pi)
            .forEach((row) => (row.refunded_at = tombstone.refunded_at));
          return { data: null, error: null };
        }
        const existing = rows.pmle_passes.find(
          (row) => row.stripe_checkout_session_id === args.p_stripe_checkout_session_id
        );
        if (existing) {
          if (
            existing.user_id !== args.p_user_id ||
            existing.stripe_payment_intent_id !== pi ||
            existing.stripe_customer_id !== args.p_stripe_customer_id ||
            existing.paid_at !== args.p_paid_at
          )
            return { data: null, error: { message: "immutable identity mismatch" } };
          return { data: existing, error: null };
        }
        if (rows.pmle_passes.some((row) => row.stripe_payment_intent_id === pi))
          return { data: null, error: { code: "23505", message: "duplicate intent" } };
        const pass = {
          id: `pass_${rows.pmle_passes.length}`,
          user_id: args.p_user_id,
          stripe_checkout_session_id: args.p_stripe_checkout_session_id,
          stripe_payment_intent_id: pi,
          stripe_customer_id: args.p_stripe_customer_id,
          paid_at: args.p_paid_at,
          expires_at: new Date(Date.parse(args.p_paid_at) + PASS_DURATION_MS).toISOString(),
          refunded_at:
            rows.pmle_pass_refunds.find((row) => row.stripe_payment_intent_id === pi)
              ?.refunded_at || null,
        };
        rows.pmle_passes.push(pass);
        return { data: pass, error: null };
      };
      return name === "fulfill_pmle_pass" ? { single: execute } : execute();
    },
    from: (table: string) => {
      let action = "select";
      let values: any;
      let options: any;
      const filters: [string, unknown][] = [];
      let result: any;
      let returnRows = false;
      const execute = () => {
        if (result) return result;
        const matches = (row: any) => filters.every(([key, value]) => row[key] === value);
        if (action !== "select") writes.push({ table, action, values, options, filters });
        if (failTable === table && action !== "select") {
          failTable = null;
          return (result = { data: null, error: { message: "temporary database failure" } });
        }
        if (action === "select")
          return (result = { data: rows[table].filter(matches), error: null });
        if (action === "update")
          rows[table].filter(matches).forEach((row) => Object.assign(row, values));
        else {
          const key =
            table === "user_subscriptions"
              ? "stripe_subscription_id"
              : table === "pmle_passes"
                ? "stripe_checkout_session_id"
                : table === "webhook_events"
                  ? "stripe_event_id"
                  : "stripe_payment_intent_id";
          const existing = rows[table].find((row) => row[key] === values[key]);
          if (
            !existing &&
            table === "pmle_passes" &&
            rows[table].some(
              (row) => row.stripe_payment_intent_id === values.stripe_payment_intent_id
            )
          ) {
            return (result = { data: null, error: { code: "23505", message: "duplicate intent" } });
          }
          if (existing) {
            if (!options?.ignoreDuplicates) Object.assign(existing, values);
          } else rows[table].push({ id: `row_${rows[table].length}`, ...values });
        }
        return (result = { data: returnRows ? rows[table].filter(matches) : null, error: null });
      };
      const query: any = {
        select: () => {
          returnRows = true;
          return query;
        },
        or: () => query,
        order: () => query,
        limit: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        insert: (data: any) => {
          action = "insert";
          values = data;
          return query;
        },
        upsert: (data: any, opts: any) => {
          action = "upsert";
          values = data;
          options = opts;
          return query;
        },
        update: (data: any) => {
          action = "update";
          values = data;
          return query;
        },
        single: async () => {
          const response = execute();
          return { ...response, data: response.data?.[0] || null };
        },
        maybeSingle: async () => {
          const response = execute();
          return { ...response, data: response.data?.[0] || null };
        },
        then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
      };
      return query;
    },
  };
  const sendEvent = async (
    type = "checkout.session.completed",
    id = "evt_checkout",
    object?: any
  ) => {
    event = {
      id,
      type,
      created: Math.floor(Date.now() / 1000),
      data: { object: object || session },
    };
    return webhook(
      new NextRequest("https://testero.ai/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "signed" },
        body: "raw-stripe-event",
      })
    );
  };
  const finish = (id = "cs_pass") =>
    success(new NextRequest(`https://testero.ai/api/billing/checkout/success?session_id=${id}`));
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
    process.env.STRIPE_PRICE_PMLE_PASS = "price_pass";
    process.env.NEXT_PUBLIC_SITE_URL = "https://testero.ai";
    process.env.PAYWALL_SIGNING_SECRET = "test-only-cookie-secret";
    rows = {
      pmle_passes: [],
      webhook_events: [],
      payment_history: [],
      pmle_pass_refunds: [],
      user_subscriptions: [],
      subscription_plans: [],
    };
    writes = [];
    failTable = null;
    beforeFulfill = undefined;
    const created = Math.floor(Date.now() / 1000);
    session = {
      id: "cs_pass",
      customer: "cus_pass",
      payment_intent: "pi_pass",
      mode: "payment",
      payment_status: "paid",
      amount_total: 3900,
      currency: "usd",
      created,
      metadata: { user_id: "user_pass", plan_name: "PMLE Pass" },
      line_items: { has_more: false, data: [{ price: { id: "price_pass" }, quantity: 1 }] },
    };
    intent = {
      id: "pi_pass",
      status: "succeeded",
      created,
      metadata: { ...session.metadata },
      latest_charge: { id: "ch_pass", created, refunded: false, amount_refunded: 0 },
    };
    sdk = {
      customers: { search: jest.fn(async () => ({ data: [{ id: "cus_pass" }] })) },
      checkout: {
        sessions: {
          create: jest.fn(async () => ({ ...session, url: "https://checkout.stripe.com/pass" })),
          retrieve: jest.fn(async () => session),
        },
      },
      subscriptions: { retrieve: jest.fn() },
      paymentIntents: { retrieve: jest.fn(async () => JSON.parse(JSON.stringify(intent))) },
      webhooks: { constructEvent: jest.fn(() => event) },
    };
    (Stripe as jest.Mock).mockImplementation(() => sdk);
    getUser = jest.fn(async () => ({
      data: { user: { id: "user_pass", email: "mock@example.test" } },
      error: null,
    }));
    (createServerSupabaseClient as jest.Mock).mockReturnValue({ ...db, auth: { getUser } });
    (createServiceSupabaseClient as jest.Mock).mockReturnValue(db);
    setCookie = jest.fn();
    (cookies as jest.Mock).mockReturnValue({ set: setCookie });
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_PMLE_PASS",
      "PAYWALL_SIGNING_SECRET",
      "NEXT_PUBLIC_SITE_URL",
    ].forEach((key) => delete process.env[key]);
  });
  test("signed-in checkout creates one-time server-price session with intent metadata", async () => {
    const response = await checkout(
      new NextRequest("https://testero.ai/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: "request-123" }),
      })
    );
    expect(response.status).toBe(200);
    expect(sdk.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [{ price: "price_pass", quantity: 1 }],
        metadata: session.metadata,
        payment_intent_data: { metadata: session.metadata },
      }),
      { idempotencyKey: "user_pass:price_pass:request-123" }
    );
  });
  test("grants exactly 90 days from the paid charge, with service-role writes", async () => {
    expect((await sendEvent()).status).toBe(200);
    expect(rows.pmle_passes).toHaveLength(1);
    const pass = rows.pmle_passes[0];
    expect(Date.parse(pass.expires_at) - Date.parse(pass.paid_at)).toBe(PASS_DURATION_MS);
    expect(pass.paid_at).toBe(new Date(intent.latest_charge.created * 1000).toISOString());
    expect(pass).toMatchObject({
      user_id: "user_pass",
      stripe_customer_id: "cus_pass",
      stripe_checkout_session_id: "cs_pass",
      stripe_payment_intent_id: "pi_pass",
      refunded_at: null,
    });
    expect(createServiceSupabaseClient).toHaveBeenCalled();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(rows.webhook_events[0].processed).toBe(true);
  });
  test("dedupes the same event without retrieving checkout again", async () => {
    await sendEvent();
    await sendEvent();
    expect(rows.pmle_passes).toHaveLength(1);
    expect(sdk.checkout.sessions.retrieve).toHaveBeenCalledTimes(1);
  });
  test("dedupes a checkout delivered with a distinct event id without extending access", async () => {
    await sendEvent();
    const original = { ...rows.pmle_passes[0] };
    await sendEvent("checkout.session.completed", "evt_checkout_duplicate");
    expect(rows.pmle_passes).toEqual([original]);
    expect(writes.filter((write) => write.name === "fulfill_pmle_pass")).toHaveLength(2);
  });
  test("revokes pass on a partial refund by payment intent", async () => {
    await sendEvent();
    intent.latest_charge.amount_refunded = 1;
    expect(
      (
        await sendEvent("charge.refunded", "evt_refund", {
          payment_intent: "pi_pass",
          amount_refunded: 1,
        })
      ).status
    ).toBe(200);
    expect(rows.pmle_passes[0].refunded_at).not.toBeNull();
  });
  test("refund-before-checkout never grants active access", async () => {
    intent.latest_charge.amount_refunded = 100;
    await sendEvent("charge.refunded", "evt_refund", { payment_intent: "pi_pass" });
    await sendEvent();
    expect(rows.pmle_passes[0].refunded_at).not.toBeNull();
  });
  test("refund after Stripe checks but before fulfillment persists a tombstone and cannot grant access", async () => {
    beforeFulfill = async () => {
      beforeFulfill = undefined;
      await sendEvent("charge.refunded", "evt_racing_refund", { payment_intent: "pi_pass" });
    };
    expect((await sendEvent()).status).toBe(200);
    expect(rows.pmle_passes[0].refunded_at).not.toBeNull();
    expect(rows.pmle_pass_refunds).toHaveLength(1);
    expect((await getPaidAccess("user_pass")).hasPaidAccess).toBe(false);
  });

  test("duplicate checkout after refund cannot clear revocation even with stale paid status", async () => {
    await sendEvent();
    await sendEvent("charge.refunded", "evt_refund", { payment_intent: "pi_pass" });
    const refundedAt = rows.pmle_passes[0].refunded_at;
    // Simulate Stripe returning the old succeeded/unrefunded intent; DB revocation wins.
    await sendEvent("checkout.session.completed", "evt_delayed_checkout");
    expect(rows.pmle_passes[0].refunded_at).toBe(refundedAt);
    expect(rows.payment_history[0].status).toBe("refunded");
  });
  test("failed grant remains unprocessed and retries successfully", async () => {
    failTable = "pmle_passes";
    expect((await sendEvent()).status).toBe(500);
    expect(rows.webhook_events[0].processed).toBe(false);
    expect(rows.pmle_passes).toHaveLength(0);
    expect((await sendEvent()).status).toBe(200);
    expect(rows.pmle_passes).toHaveLength(1);
    expect(rows.webhook_events[0].processed).toBe(true);
  });
  test("failed revocation remains unprocessed and retries", async () => {
    await sendEvent();
    failTable = "pmle_passes";
    expect(
      (await sendEvent("charge.refunded", "evt_refund", { payment_intent: "pi_pass" })).status
    ).toBe(500);
    expect(rows.webhook_events.find((row) => row.stripe_event_id === "evt_refund").processed).toBe(
      false
    );
    await sendEvent("charge.refunded", "evt_refund", { payment_intent: "pi_pass" });
    expect(rows.pmle_passes[0].refunded_at).not.toBeNull();
  });
  test("unique payment intent rejects a second checkout and retains retryability", async () => {
    await sendEvent();
    session.id = "cs_forged_duplicate";
    expect((await sendEvent("checkout.session.completed", "evt_second_session")).status).toBe(500);
    expect(rows.pmle_passes).toHaveLength(1);
    expect(rows.webhook_events[1].processed).toBe(false);
  });
  test.each([
    "unpaid",
    "wrong_price",
    "wrong_plan",
    "no_line_items",
    "extra_line_items",
    "wrong_quantity",
  ])("does not grant %s checkout", async (variant) => {
    if (variant === "unpaid") session.payment_status = "unpaid";
    if (variant === "wrong_price") session.line_items.data[0].price.id = "price_other";
    if (variant === "wrong_plan") session.metadata.plan_name = "other";
    if (variant === "no_line_items") delete session.line_items;
    if (variant === "extra_line_items") session.line_items.has_more = true;
    if (variant === "wrong_quantity") session.line_items.data[0].quantity = 2;
    expect((await sendEvent()).status).toBe(200);
    expect(rows.pmle_passes).toHaveLength(0);
  });
  test("rejects missing user metadata", async () => {
    delete session.metadata.user_id;
    expect((await sendEvent()).status).toBe(400);
    expect(rows.pmle_passes).toHaveLength(0);
    expect(rows.webhook_events[0].processed).toBe(false);
  });
  test("intent metadata ownership mismatch fails closed and retries", async () => {
    intent.metadata.user_id = "another_user";
    expect((await sendEvent()).status).toBe(500);
    expect(rows.pmle_passes).toHaveLength(0);
    expect(rows.webhook_events[0].processed).toBe(false);
  });
  test.each(["not_succeeded", "wrong_plan", "unexpanded_charge", "invalid_paid_time"])(
    "intent validation rejects %s without marking processed",
    async (variant) => {
      if (variant === "not_succeeded") intent.status = "processing";
      if (variant === "wrong_plan") intent.metadata.plan_name = "other";
      if (variant === "unexpanded_charge") intent.latest_charge = "ch_pass";
      if (variant === "invalid_paid_time") intent.latest_charge.created = 0;
      expect((await sendEvent()).status).toBe(500);
      expect(rows.pmle_passes).toHaveLength(0);
      expect(rows.webhook_events[0].processed).toBe(false);
    }
  );
  test("failed second Stripe read publishes no pass and retries without extending access", async () => {
    sdk.paymentIntents.retrieve
      .mockResolvedValueOnce(JSON.parse(JSON.stringify(intent)))
      .mockRejectedValueOnce(new Error("Stripe temporarily unavailable"));
    expect((await sendEvent()).status).toBe(500);
    expect(rows.webhook_events[0].processed).toBe(false);
    expect(rows.pmle_passes).toHaveLength(0);
    expect((await getPaidAccess("user_pass")).hasPaidAccess).toBe(false);
    expect((await sendEvent()).status).toBe(200);
    expect(rows.pmle_passes).toHaveLength(1);
    expect(rows.pmle_passes[0].paid_at).toBe(
      new Date(intent.latest_charge.created * 1000).toISOString()
    );
  });

  test.each(["created", "updated", "deleted"])(
    "legacy subscription.%s write failure retries instead of being marked processed",
    async (kind) => {
      const created = Math.floor(Date.now() / 1000);
      const subscription = {
        id: "sub_legacy",
        customer: "cus_legacy",
        status: kind === "created" ? "active" : "canceled",
        metadata: { user_id: "user_legacy" },
        items: {
          data: [
            {
              price: { id: "price_legacy" },
              current_period_start: created,
              current_period_end: created + 2592000,
            },
          ],
        },
        cancel_at_period_end: false,
      };
      sdk.subscriptions.retrieve.mockResolvedValue(subscription);
      if (kind !== "created")
        rows.user_subscriptions.push({
          user_id: "user_legacy",
          stripe_subscription_id: "sub_legacy",
          status: "active",
        });
      failTable = "user_subscriptions";
      expect(
        (await sendEvent(`customer.subscription.${kind}`, `evt_legacy_${kind}`, subscription))
          .status
      ).toBe(500);
      expect(rows.webhook_events[0].processed).toBe(false);
      if (kind === "created") expect(rows.user_subscriptions).toHaveLength(0);
      else expect(rows.user_subscriptions[0].status).toBe("active");
      expect(
        (await sendEvent(`customer.subscription.${kind}`, `evt_legacy_${kind}`, subscription))
          .status
      ).toBe(200);
      expect(rows.webhook_events[0].processed).toBe(true);
      expect(rows.user_subscriptions[0].status).toBe(kind === "created" ? "active" : "canceled");
    }
  );
  test("refund-before-fulfillment plus failed second Stripe read grants nothing and retry retains revocation", async () => {
    sdk.paymentIntents.retrieve
      .mockImplementationOnce(async () => {
        const staleIntent = JSON.parse(JSON.stringify(intent));
        intent.latest_charge.amount_refunded = 1;
        await sendEvent("charge.refunded", "evt_preinsert_refund", { payment_intent: "pi_pass" });
        return staleIntent;
      })
      .mockRejectedValueOnce(new Error("Stripe post-read unavailable"));
    expect((await finish()).headers.get("location")).toContain("success=0");
    expect(rows.webhook_events[0].processed).toBe(true);
    expect(rows.pmle_pass_refunds).toHaveLength(1);
    expect(rows.pmle_passes).toHaveLength(0);
    expect((await getPaidAccess("user_pass")).hasPaidAccess).toBe(false);
    expect(setCookie).not.toHaveBeenCalled();
    expect((await sendEvent()).status).toBe(200);
    expect(rows.pmle_passes[0].refunded_at).not.toBeNull();
    expect((await getPaidAccess("user_pass")).hasPaidAccess).toBe(false);
  });
  test("fulfillment RPC failure grants nothing and can retry", async () => {
    failTable = "pmle_passes";
    expect((await sendEvent()).status).toBe(500);
    expect(rows.pmle_passes).toHaveLength(0);
    expect((await getPaidAccess("user_pass")).hasPaidAccess).toBe(false);
    expect(rows.webhook_events[0].processed).toBe(false);
    expect((await sendEvent()).status).toBe(200);
    expect((await getPaidAccess("user_pass")).hasPaidAccess).toBe(true);
  });
  test("late stale active subscription event cannot restore canceled legacy access", async () => {
    const created = Math.floor(Date.now() / 1000);
    const canceled = {
      id: "sub_legacy",
      status: "canceled",
      items: {
        data: [
          {
            price: { id: "price_legacy" },
            current_period_start: created,
            current_period_end: created + 2592000,
          },
        ],
      },
      cancel_at_period_end: false,
    };
    rows.user_subscriptions.push({
      user_id: "user_legacy",
      stripe_subscription_id: "sub_legacy",
      status: "active",
    });
    await sendEvent("customer.subscription.deleted", "evt_legacy_deleted", canceled);
    sdk.subscriptions.retrieve.mockResolvedValue(canceled);
    expect(
      (
        await sendEvent("customer.subscription.updated", "evt_stale_active", {
          ...canceled,
          status: "active",
        })
      ).status
    ).toBe(200);
    expect(rows.user_subscriptions[0].status).toBe("canceled");
    expect(sdk.subscriptions.retrieve).toHaveBeenCalledWith("sub_legacy", {
      expand: ["items.data.price"],
    });
    expect((await getPaidAccess("user_legacy")).hasPaidAccess).toBe(false);
  });
  test("current legacy subscription retrieval failure retries before writing status", async () => {
    const created = Math.floor(Date.now() / 1000);
    const canceled = {
      id: "sub_legacy",
      status: "canceled",
      items: {
        data: [
          {
            price: { id: "price_legacy" },
            current_period_start: created,
            current_period_end: created + 2592000,
          },
        ],
      },
      cancel_at_period_end: false,
    };
    rows.user_subscriptions.push({
      user_id: "user_legacy",
      stripe_subscription_id: "sub_legacy",
      status: "active",
    });
    sdk.subscriptions.retrieve
      .mockRejectedValueOnce(new Error("Stripe unavailable"))
      .mockResolvedValue(canceled);
    expect(
      (await sendEvent("customer.subscription.updated", "evt_current_legacy", canceled)).status
    ).toBe(500);
    expect(rows.webhook_events[0].processed).toBe(false);
    expect(rows.user_subscriptions[0].status).toBe("active");
    expect(
      (await sendEvent("customer.subscription.updated", "evt_current_legacy", canceled)).status
    ).toBe(200);
    expect(rows.user_subscriptions[0].status).toBe("canceled");
  });
  test("refund updates payment history and a late succeeded event cannot reset it", async () => {
    await sendEvent();
    intent.latest_charge.amount_refunded = 1;
    await sendEvent("charge.refunded", "evt_history_refund", { payment_intent: "pi_pass" });
    expect(rows.payment_history[0].status).toBe("refunded");
    expect(
      (
        await sendEvent("payment_intent.succeeded", "evt_late_succeeded", {
          id: "pi_pass",
          amount: 3900,
          currency: "usd",
          metadata: session.metadata,
        })
      ).status
    ).toBe(200);
    expect(rows.payment_history[0].status).toBe("refunded");
    expect((await getPaidAccess("user_pass")).hasPaidAccess).toBe(false);
  });
  test("success fulfills before webhook, signs bound 15-minute cookie, and dedupes webhook", async () => {
    const response = await finish();
    expect(response.headers.get("location")).toBe("https://testero.ai/dashboard/billing?success=1");
    expect(rows.pmle_passes).toHaveLength(1);
    expect(setCookie).toHaveBeenCalledWith(
      "checkout_grace",
      expect.any(String),
      expect.objectContaining({ maxAge: 900, httpOnly: true })
    );
    const payload = JSON.parse(
      Buffer.from(setCookie.mock.calls[0][1].split(".")[0], "base64url").toString()
    );
    expect(payload).toMatchObject({ userId: "user_pass", checkoutSessionId: "cs_pass" });
    await sendEvent();
    expect(rows.pmle_passes).toHaveLength(1);
  });
  test("success cannot issue cookie after Stripe refund", async () => {
    intent.latest_charge.refunded = true;
    expect((await finish()).headers.get("location")).toContain("success=0");
    expect(setCookie).not.toHaveBeenCalled();
    expect(rows.pmle_passes[0].refunded_at).not.toBeNull();
  });
  test("success cannot bypass a persisted refund with stale Stripe state", async () => {
    await sendEvent();
    await sendEvent("charge.refunded", "evt_refund", { payment_intent: "pi_pass" });
    const revoked = rows.pmle_passes[0].refunded_at;
    expect((await finish()).headers.get("location")).toContain("success=0");
    expect(rows.pmle_passes[0].refunded_at).toBe(revoked);
    expect(setCookie).not.toHaveBeenCalled();
  });
  test("success cannot revive an expired pass", async () => {
    intent.latest_charge.created -= 91 * 24 * 60 * 60;
    expect((await finish()).headers.get("location")).toContain("success=0");
    expect(setCookie).not.toHaveBeenCalled();
  });
  test.each(["anonymous", "another_user", "unpaid", "subscription", "wrong_price"])(
    "success rejects %s",
    async (variant) => {
      if (variant === "anonymous") getUser.mockResolvedValue({ data: { user: null }, error: null });
      if (variant === "another_user") session.metadata.user_id = "another_user";
      if (variant === "unpaid") session.payment_status = "unpaid";
      if (variant === "subscription") session.mode = "subscription";
      if (variant === "wrong_price") session.line_items.data[0].price.id = "price_other";
      expect((await finish()).headers.get("location")).toContain("success=0");
      expect(rows.pmle_passes).toHaveLength(0);
      expect(setCookie).not.toHaveBeenCalled();
    }
  );
  test("success fails closed on missing session id", async () => {
    expect(
      (
        await success(new NextRequest("https://testero.ai/api/billing/checkout/success"))
      ).headers.get("location")
    ).toContain("success=0");
    expect(setCookie).not.toHaveBeenCalled();
  });
  test("success fails closed on grant failure and webhook can retry", async () => {
    failTable = "pmle_passes";
    expect((await finish()).headers.get("location")).toContain("success=0");
    expect(setCookie).not.toHaveBeenCalled();
    expect((await sendEvent()).status).toBe(200);
    expect(rows.pmle_passes).toHaveLength(1);
  });
});
