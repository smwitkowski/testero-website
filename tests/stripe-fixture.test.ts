import { Readable } from "node:stream";
import { beforeEach, expect, it, vi } from "vitest";
import { PMLE_PASS_PRICE } from "@/lib/billing/pmle-pass";

// Exercise the fixture HTTP handler without opening its fixed local-runner port.
const mocks = vi.hoisted(() => ({ handler: null as null | ((request: unknown, response: unknown) => Promise<unknown>) }));
vi.mock("node:http", () => ({ createServer: (handler: (request: unknown, response: unknown) => Promise<unknown>) => {
  mocks.handler = handler;
  return { once: vi.fn(), listen: (_port: number, _host: string, ready: () => void) => ready(), unref: vi.fn(), close: (done: () => void) => done(), closeAllConnections: vi.fn() };
} }));
// @ts-expect-error Operational fixture is native ESM, not application TypeScript.
import { LOCAL_STRIPE_ENV, startStripeFixtureServer } from "../scripts/stripe-fixture.mjs";

beforeEach(() => { mocks.handler = null; });
async function request(path: string, body: string, control = false) {
  let status = 0;
  let responseBody = "";
  const input = Object.assign(Readable.from([body]), {
    url: path, method: "POST", headers: {
      authorization: `Bearer ${control ? LOCAL_STRIPE_ENV.STRIPE_WEBHOOK_SECRET : LOCAL_STRIPE_ENV.STRIPE_SECRET_KEY}`,
      "idempotency-key": "unit-price-check",
    },
  });
  await mocks.handler!(input, { writeHead: (code: number) => { status = code; }, end: (text: string) => { responseBody = text; } });
  expect(status).toBe(200);
  return JSON.parse(responseBody);
}
it("uses the shared PMLE cents for session, line item, charge and intent, then refunds the actual amount", async () => {
  const fixture = await startStripeFixtureServer();
  try {
    const cents = Math.round(PMLE_PASS_PRICE * 100);
    const session = await request("/v1/checkout/sessions", new URLSearchParams({
      mode: "payment", "allowed_payment_method_types[0]": "card", "line_items[0][price]": LOCAL_STRIPE_ENV.STRIPE_PRICE_PMLE_PASS,
      customer: "cus_local_unit", "metadata[user_id]": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "metadata[plan_name]": "PMLE Pass",
      "payment_intent_data[metadata][user_id]": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "payment_intent_data[metadata][plan_name]": "PMLE Pass",
    }).toString());
    expect(session.amount_total).toBe(cents);
    expect(session.line_items.data[0].price.unit_amount).toBe(cents);
    const paid = await request("/__testero__/pay", JSON.stringify({ sessionId: session.id }), true);
    expect(paid.session.amount_total).toBe(cents);
    expect(paid.charge.amount).toBe(cents);
    expect(paid.intent.amount).toBe(cents);
    const refunded = await request("/__testero__/refund", JSON.stringify({ paymentIntentId: paid.intent.id }), true);
    expect(refunded.charge.refunded).toBe(true);
    expect(refunded.charge.amount_refunded).toBe(paid.intent.amount);
  } finally { await fixture.close(); }
});
