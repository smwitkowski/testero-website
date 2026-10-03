import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StripeService } from "./stripe-service";

export const PASS_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

export function stripeId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id || null;
}

/** Line items, not client metadata or totals, identify the purchased product. */
export function isPaidPassSession(session: Stripe.Checkout.Session): boolean {
  const priceId = process.env.STRIPE_PRICE_PMLE_PASS;
  const items = session.line_items;
  return Boolean(
    priceId &&
      session.mode === "payment" &&
      session.payment_status === "paid" &&
      session.metadata?.user_id &&
      session.metadata?.plan_name === "PMLE Pass" &&
      stripeId(session.payment_intent) &&
      stripeId(session.customer) &&
      items &&
      !items.has_more &&
      items.data.length === 1 &&
      items.data[0].price?.id === priceId &&
      items.data[0].quantity === 1
  );
}

/** Always read current charge state; a stale checkout event cannot undo a refund. */
export async function getPassPayment(service: StripeService, session: Stripe.Checkout.Session) {
  const id = stripeId(session.payment_intent);
  if (!id) throw new Error("Missing pass payment intent");
  const intent = await service.retrievePaymentIntent(id, ["latest_charge"]);
  if (
    intent.status !== "succeeded" ||
    intent.metadata?.user_id !== session.metadata?.user_id ||
    intent.metadata?.plan_name !== "PMLE Pass"
  ) {
    throw new Error("Invalid pass payment ownership or status");
  }
  const charge = intent.latest_charge;
  if (
    !charge ||
    typeof charge === "string" ||
    !Number.isFinite(charge.created) ||
    charge.created <= 0
  ) {
    throw new Error("Pass charge was not expanded or has invalid paid time");
  }
  return { intent, charge, refunded: charge.refunded || charge.amount_refunded > 0 };
}

/** Both the verified success redirect and webhook use the same fulfillment path. */
export async function grantPmlePass(
  service: StripeService,
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  if (!isPaidPassSession(session)) throw new Error("Invalid paid PMLE Pass checkout");
  const paymentIntentId = stripeId(session.payment_intent)!;
  const payment = await getPassPayment(service, session);
  // Stripe's successful charge time is stable across event retries and redirects.
  const paidAt = new Date(payment.charge.created * 1000);
  const { error: insertError } = await supabase.from("pmle_passes").upsert(
    {
      user_id: session.metadata!.user_id,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: stripeId(session.customer)!,
      paid_at: paidAt.toISOString(),
      expires_at: new Date(paidAt.getTime() + PASS_DURATION_MS).toISOString(),
      refunded_at: payment.refunded ? new Date().toISOString() : null,
    },
    { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true }
  );
  if (insertError) throw insertError;

  // Close a refund-before-insert race. Duplicate checkouts never update the row.
  const current = await getPassPayment(service, session);
  if (payment.refunded || current.refunded) {
    const { error } = await supabase
      .from("pmle_passes")
      .update({ refunded_at: new Date().toISOString() })
      .eq("stripe_payment_intent_id", paymentIntentId);
    if (error) throw error;
  }
  const { data: pass, error } = await supabase
    .from("pmle_passes")
    .select("user_id, stripe_payment_intent_id, refunded_at, expires_at")
    .eq("stripe_checkout_session_id", session.id)
    .single();
  if (error) throw error;
  if (
    !pass ||
    pass.user_id !== session.metadata!.user_id ||
    pass.stripe_payment_intent_id !== paymentIntentId
  )
    throw new Error("Pass ownership mismatch");
  return { pass, refunded: Boolean(pass.refunded_at || payment.refunded || current.refunded) };
}
