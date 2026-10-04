/** Loopback-only Stripe HTTP fixture. Imported only by scripts/local.mjs.
 * No remote calls, real cards, payment processing, or production credentials.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
export const LOCAL_STRIPE_ENV = Object.freeze({
  TESTERO_LOCAL_STRIPE: "1", STRIPE_SECRET_KEY: "sk_test_testero_local_only",
  STRIPE_WEBHOOK_SECRET: "whsec_testero_local_only", STRIPE_PRICE_PMLE_PASS: "price_testero_local_pmle",
});
const PORT = 56545;
const MARKER = "testero-v2-stripe-fixture";
const id = prefix => prefix + randomUUID().replaceAll("-", "");
function reply(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}
async function body(request) {
  let result = "";
  for await (const part of request) { result += part; if (result.length > 1_000_000) throw new Error("Too large"); }
  return result;
}
export async function startStripeFixtureServer() {
  const customers = new Map(), sessions = new Map(), intents = new Map(), keys = new Map();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
      const path = url.pathname;
      if (path === "/__testero__/health" && request.method === "GET") return reply(response, 200, { project: MARKER, fixtureOnly: true });
      const auth = request.headers.authorization;
      const control = path.startsWith("/__testero__/");
      if (auth !== `Bearer ${control ? LOCAL_STRIPE_ENV.STRIPE_WEBHOOK_SECRET : LOCAL_STRIPE_ENV.STRIPE_SECRET_KEY}`) return reply(response, 401, { error: { type: "authentication_error", message: "Local fixture auth required" } });
      if (path === "/__testero__/pay" && request.method === "POST") {
        const input = JSON.parse(await body(request));
        const session = sessions.get(input.sessionId);
        if (!session) return reply(response, 404, { error: "Unknown local session" });
        session.payment_status = "paid";
        const charge = { id: id("ch_local_"), object: "charge", created: Math.floor(Date.now() / 1000), amount: 3900, amount_refunded: 0, refunded: false, currency: "usd", payment_intent: session.payment_intent, paid: true, status: "succeeded" };
        const intent = { id: session.payment_intent, object: "payment_intent", status: "succeeded", amount: 3900, currency: "usd", metadata: session.metadata, latest_charge: charge };
        intents.set(intent.id, intent);
        return reply(response, 200, { session, intent, charge });
      }
      if (path === "/__testero__/refund" && request.method === "POST") {
        const input = JSON.parse(await body(request));
        const intent = intents.get(input.paymentIntentId);
        if (!intent) return reply(response, 404, { error: "Unknown local intent" });
        intent.latest_charge.refunded = true; intent.latest_charge.amount_refunded = 3900;
        return reply(response, 200, { charge: intent.latest_charge });
      }
      if (path === "/v1/customers/search" && request.method === "GET") {
        const query = url.searchParams.get("query") ?? "";
        const user = query.match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)?.[0];
        return reply(response, 200, { object: "search_result", data: [...customers.values()].filter(customer => customer.metadata.supabase_user_id === user), has_more: false, url: path });
      }
      if (path === "/v1/customers" && request.method === "POST") {
        const form = new URLSearchParams(await body(request));
        const user = form.get("metadata[supabase_user_id]");
        const prior = [...customers.values()].find(customer => customer.metadata.supabase_user_id === user);
        const customer = prior ?? { id: id("cus_local_"), object: "customer", livemode: false, metadata: { supabase_user_id: user } };
        customers.set(customer.id, customer); return reply(response, 200, customer);
      }
      if (path === "/v1/checkout/sessions" && request.method === "POST") {
        const form = new URLSearchParams(await body(request));
        const key = request.headers["idempotency-key"];
        if (typeof key !== "string" || !key) return reply(response, 400, { error: { message: "Idempotency key required" } });
        if (keys.has(key)) return reply(response, 200, sessions.get(keys.get(key)));
        if (form.get("mode") !== "payment" || form.get("allowed_payment_method_types[0]") !== "card" || form.get("line_items[0][price]") !== LOCAL_STRIPE_ENV.STRIPE_PRICE_PMLE_PASS) return reply(response, 400, { error: { message: "Local configured payment price required" } });
        const sessionId = id("cs_test_local_");
        const session = { id: sessionId, object: "checkout.session", livemode: false, created: Math.floor(Date.now() / 1000), mode: "payment", payment_status: "unpaid", customer: form.get("customer"), payment_intent: id("pi_local_"), amount_total: 3900, currency: "usd",
          metadata: { user_id: form.get("metadata[user_id]"), plan_name: form.get("metadata[plan_name]") },
          line_items: { object: "list", has_more: false, data: [{ id: id("li_local_"), object: "item", quantity: 1, price: { id: LOCAL_STRIPE_ENV.STRIPE_PRICE_PMLE_PASS, object: "price", type: "one_time", unit_amount: 3900, currency: "usd" } }] },
          url: `http://127.0.0.1:3000/checkout/success?session_id=${sessionId}` };
        if (!session.customer || !session.metadata.user_id || session.metadata.plan_name !== "PMLE Pass" || form.get("payment_intent_data[metadata][user_id]") !== session.metadata.user_id || form.get("payment_intent_data[metadata][plan_name]") !== "PMLE Pass") return reply(response, 400, { error: { message: "Local ownership metadata required" } });
        sessions.set(session.id, session); keys.set(key, session.id); return reply(response, 200, session);
      }
      if (path.startsWith("/v1/checkout/sessions/") && request.method === "GET") {
        const session = sessions.get(decodeURIComponent(path.split("/").at(-1)));
        return session ? reply(response, 200, session) : reply(response, 404, { error: { message: "Unknown local checkout" } });
      }
      if (path.startsWith("/v1/payment_intents/") && request.method === "GET") {
        const intent = intents.get(decodeURIComponent(path.split("/").at(-1)));
        return intent ? reply(response, 200, intent) : reply(response, 404, { error: { message: "Unknown local intent" } });
      }
      if (path === "/v1/billing_portal/sessions" && request.method === "POST") return reply(response, 200, { id: id("bps_local_"), object: "billing_portal.session", url: "http://127.0.0.1:3000/account" });
      return reply(response, 404, { error: { message: "Unknown local fixture route" } });
    } catch { return reply(response, 400, { error: { message: "Invalid local fixture request" } }); }
  });
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(PORT, "127.0.0.1", resolve); });
    server.unref();
    return { owned: true, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
    const existing = await fetch(`http://127.0.0.1:${PORT}/__testero__/health`, { signal: AbortSignal.timeout(1000) });
    const health = await existing.json();
    if (!existing.ok || health.project !== MARKER || health.fixtureOnly !== true) throw new Error("Local fixture port belongs to another service");
    return { owned: false, close: async () => {} };
  }
}
