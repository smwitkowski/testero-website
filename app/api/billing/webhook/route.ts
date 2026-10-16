import type Stripe from "stripe";
import { StripeService } from "@/lib/stripe/stripe-service";
import { fulfillCheckoutSession, isPaidPassSession, refundPmlePass, stripeId } from "@/lib/stripe/pmle-pass";
import { HANDLED_STRIPE_EVENTS } from "@/lib/stripe/events";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { billingJson, billingErrorResponse } from "@/lib/billing/http";
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
    try {
      if (HANDLED_STRIPE_EVENTS.some(type => type === event.type)) switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const delivered = event.data.object as Stripe.Checkout.Session;
          const session = await stripe.retrieveCheckoutSession(delivered.id);
          if (session.id !== delivered.id) throw new Error("Checkout identity mismatch");
          if (!isPaidPassSession(session)) break;
          await fulfillCheckoutSession(stripe, db, session);
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
      }
      // Never mark processed before all durable billing writes succeed.
      const { error } = await db.from("webhook_events").update({ processed: true, error: null, processed_at: new Date().toISOString() }).eq("stripe_event_id", event.id);
      if (error) throw error;
    } catch (error) {
      // Do not persist raw provider errors, customer objects, or secrets in the ledger.
      await db.from("webhook_events").update({ error: "Billing processing failed" }).eq("stripe_event_id", event.id);
      throw error;
    }
    return billingJson({ received: true });
  } catch (error) { return billingErrorResponse(error); }
}
