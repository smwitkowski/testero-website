import type Stripe from "stripe";
import { StripeService } from "@/lib/stripe/stripe-service";
import { grantPmlePass, isPaidPassSession, refundPmlePass, stripeId } from "@/lib/stripe/pmle-pass";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { billingJson, billingErrorResponse } from "@/lib/billing/http";
import { trackPurchaseCompleted } from "@/lib/analytics/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return billingJson({ error: "Missing stripe signature" }, 400);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Missing webhook configuration");
    const stripe = new StripeService();
    let event: Stripe.Event;
    const payload = await request.text();
    try { event = stripe.constructWebhookEvent(payload, signature, secret); }
    catch { return billingJson({ error: "Invalid webhook signature" }, 400); }
    const db = createServiceSupabaseClient();
    const { data: existing, error: lookupError } = await db.from("webhook_events")
      .select("processed").eq("stripe_event_id", event.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.processed) return billingJson({ received: true });
    if (!existing) {
      const { error } = await db.from("webhook_events").insert({ stripe_event_id: event.id, type: event.type, processed: false });
      // Parallel deliveries may create the same ledger row. Entitlement RPCs are idempotent.
      if (error && error.code !== "23505") throw error;
    }
    let purchasedSession: string | null = null;
    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const delivered = event.data.object as Stripe.Checkout.Session;
          const session = await stripe.retrieveCheckoutSession(delivered.id);
          if (session.id !== delivered.id) throw new Error("Checkout identity mismatch");
          if (!isPaidPassSession(session)) break;
          const { refunded } = await grantPmlePass(stripe, db, session);
          // The RPC shares the fulfillment/refund payment-intent lock and derives
          // ownership/refund state inside the transaction, never from this snapshot.
          const { error } = await db.rpc("record_pmle_pass_payment", {
            p_stripe_payment_intent_id: stripeId(session.payment_intent),
            p_amount: session.amount_total ?? 0, p_currency: session.currency ?? "usd",
          });
          if (error) throw error;
          if (!refunded) purchasedSession = session.id;
          break;
        }
        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          const intentId = stripeId(charge.payment_intent);
          if (!intentId) break;
          // Any refund (including partial) revokes access. RPC tombstones survive reordering.
          await refundPmlePass(db, intentId, new Date(event.created * 1000).toISOString());
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          // Maintain existing legacy rows only. Never create new tiers or subscriptions.
          const delivered = event.data.object as Stripe.Subscription;
          const { data: owned, error: ownedError } = await db.from("user_subscriptions")
            .select("id, stripe_customer_id").eq("stripe_subscription_id", delivered.id).maybeSingle();
          if (ownedError) throw ownedError;
          if (!owned) break;
          const current = await stripe.retrieveSubscription(delivered.id);
          if (current.id !== delivered.id || stripeId(current.customer) !== owned.stripe_customer_id) throw new Error("Subscription ownership mismatch");
          const { error } = await db.from("user_subscriptions").update({
            status: current.status, cancel_at_period_end: current.cancel_at_period_end, updated_at: new Date().toISOString(),
          }).eq("id", owned.id).eq("stripe_customer_id", owned.stripe_customer_id);
          if (error) throw error;
          break;
        }
      }
      // Never mark processed before all durable billing writes succeed.
      const { error } = await db.from("webhook_events").update({ processed: true, error: null, processed_at: new Date().toISOString() }).eq("stripe_event_id", event.id);
      if (error) throw error;
    } catch (error) {
      // Do not persist raw provider errors, customer objects, or secrets in the ledger.
      await db.from("webhook_events").update({ error: "Billing processing failed" }).eq("stripe_event_id", event.id);
      throw error;
    }
    if (purchasedSession) await trackPurchaseCompleted(purchasedSession);
    return billingJson({ received: true });
  } catch (error) { return billingErrorResponse(error); }
}
