import "server-only";
import Stripe from "stripe";

/** A tiny SDK adapter. The explicit fixture gate can never fall back to Stripe. */
export class StripeService {
  private readonly stripe: Stripe;
  private readonly local: boolean;
  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Stripe configuration is missing");
    const localFlag = process.env.TESTERO_LOCAL_STRIPE;
    const localKey = key === "sk_test_testero_local_only";
    let local = false;
    if (localFlag !== undefined || localKey) {
      let url: URL;
      try { url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""); }
      catch { throw new Error("Invalid local Stripe configuration"); }
      local = localFlag === "1" && process.env.NODE_ENV !== "production" && localKey &&
        url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.port === "56541";
      if (!local) throw new Error("Invalid local Stripe configuration");
    }
    if (!local && [key, process.env.STRIPE_PRICE_PMLE_PASS, process.env.STRIPE_WEBHOOK_SECRET]
      .some(value => value && /placeholder|testero_local/i.test(value))) throw new Error("Local placeholder Stripe configuration is forbidden");
    this.local = local;
    this.stripe = new Stripe(key, {
      typescript: true,
      ...(local ? { host: "127.0.0.1", port: 56545, protocol: "http" as const, maxNetworkRetries: 0 } : {}),
    });
  }
  async createOrRetrieveCustomer(userId: string): Promise<Stripe.Customer> {
    const escaped = userId.replace(/["\\]/g, "\\$&");
    const existing = await this.stripe.customers.search({ query: `metadata["supabase_user_id"]:"${escaped}"` });
    if (existing.data.length) return existing.data[0];
    return this.stripe.customers.create({ metadata: { supabase_user_id: userId } }, { idempotencyKey: `pmle-customer:${userId}` });
  }
  async createCheckoutSession(input: { customerId: string; userId: string; successUrl: string; cancelUrl: string; idempotencyKey: string }): Promise<Stripe.Checkout.Session> {
    const price = process.env.STRIPE_PRICE_PMLE_PASS;
    if (!price) throw new Error("Pass price configuration is missing");
    const metadata = { user_id: input.userId, plan_name: "PMLE Pass" };
    const session = await this.stripe.checkout.sessions.create({
      customer: input.customerId, mode: "payment", allowed_payment_method_types: ["card"],
      line_items: [{ price, quantity: 1 }], metadata, payment_intent_data: { metadata },
      success_url: input.successUrl, cancel_url: input.cancelUrl,
    }, { idempotencyKey: input.idempotencyKey });
    if (!session.url) throw new Error("Missing checkout URL");
    const url = new URL(session.url);
    const expected = new URL(input.successUrl);
    const permitted = this.local
      ? url.origin === expected.origin && url.pathname === "/checkout/success" && url.searchParams.get("session_id") === session.id
      : url.protocol === "https:" && url.hostname === "checkout.stripe.com";
    if (!permitted) throw new Error("Invalid checkout URL");
    return session;
  }
  retrieveCheckoutSession(id: string) {
    return this.stripe.checkout.sessions.retrieve(id, { expand: ["customer", "line_items.data.price"] });
  }
  retrievePaymentIntent(id: string, expand: string[] = []) { return this.stripe.paymentIntents.retrieve(id, { expand }); }
  async createPortalSession(customerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    const url = new URL(session.url);
    const permitted = this.local ? url.origin === new URL(returnUrl).origin : url.protocol === "https:" && url.hostname === "billing.stripe.com";
    if (!permitted) throw new Error("Invalid portal URL");
    return session;
  }
  retrieveSubscription(id: string) { return this.stripe.subscriptions.retrieve(id); }
  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string) { return this.stripe.webhooks.constructEvent(payload, signature, secret); }
}
