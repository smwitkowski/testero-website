import Stripe from "stripe";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StripeService } from "./stripe-service";
import { trackPurchaseCompleted } from "@/lib/analytics/server";

export const PASS_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

interface FulfilledPmlePass {
  id: string;
  user_id: string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id: string;
  stripe_customer_id: string;
  paid_at: string;
  expires_at: string;
  refunded_at: string | null;
  created_at: string;
}

export function stripeId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id || null;
}

/** Configuration is all-or-nothing; legacy prices can never replace the current price. */
function passPriceIds(): Set<string> | null {
  const current = process.env.STRIPE_PRICE_PMLE_PASS;
  const legacy = process.env.STRIPE_PRICE_PMLE_PASS_LEGACY?.trim();
  const ids = [current, ...(legacy ? legacy.split(",").map(id => id.trim()) : [])];
  if (ids.some(id => !id || !/^price_[A-Za-z0-9_]{1,240}$/.test(id))) return null;
  return new Set(ids as string[]);
}

/** Product shape and ownership metadata still need current payment verification. */
function hasPaidPassShape(session: Stripe.Checkout.Session): boolean {
  const items = session.line_items;
  return Boolean(
    session.mode === "payment" &&
      session.payment_status === "paid" &&
      session.metadata?.user_id &&
      session.metadata?.plan_name === "PMLE Pass" &&
      stripeId(session.payment_intent) &&
      stripeId(session.customer) &&
      items &&
      !items.has_more &&
      items.data.length === 1 &&
      items.data[0].price?.id &&
      items.data[0].quantity === 1
  );
}

/** Line items, not client metadata or totals, identify the purchased product. */
export function isPaidPassSession(session: Stripe.Checkout.Session): boolean {
  return hasPaidPassShape(session) && Boolean(passPriceIds()?.has(session.line_items!.data[0].price!.id));
}

/** Keep paid price/configuration failures visible and retryable, without provider data. */
export function assertPaidPassPriceRecognized(session: Stripe.Checkout.Session): void {
  if (!hasPaidPassShape(session)) return;
  const prices = passPriceIds();
  if (prices?.has(session.line_items!.data[0].price!.id)) return;
  // Fixed messages only: never log checkout/payment IDs, metadata, or customer data.
  console.error(prices ? "Paid PMLE Pass price is not allowlisted" : "Invalid PMLE Pass price configuration");
  throw new Error("Paid PMLE Pass requires billing configuration recovery");
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

/** Refunds are durable even when the checkout row does not exist yet. */
export async function refundPmlePass(
  supabase: SupabaseClient,
  paymentIntentId: string,
  refundedAt: string
) {
  const { error } = await supabase.rpc("refund_pmle_pass", {
    p_stripe_payment_intent_id: paymentIntentId,
    p_refunded_at: refundedAt,
  });
  if (error) throw error;
}

/** Fulfillment requires server-retrieved Stripe payment and product verification. */
export async function grantPmlePass(
  service: StripeService,
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  assertPaidPassPriceRecognized(session);
  if (!isPaidPassSession(session)) throw new Error("Invalid paid PMLE Pass checkout");
  const paymentIntentId = stripeId(session.payment_intent)!;
  const payment = await getPassPayment(service, session);
  // Finish all fallible Stripe reads before publishing a new entitlement.
  const current = await getPassPayment(service, session);
  const paidAt = new Date(payment.charge.created * 1000).toISOString();
  if (payment.refunded || current.refunded) {
    await refundPmlePass(supabase, paymentIntentId, new Date().toISOString());
  }
  // Fulfill and refund share a database transaction lock keyed by payment intent.
  // A durable tombstone makes refund-before-checkout ordering safe. Duplicate
  // checkout IDs never change the original expiry or clear revoked access.
  const { data: pass, error } = await supabase
    .rpc("fulfill_pmle_pass", {
      p_user_id: session.metadata!.user_id,
      p_stripe_checkout_session_id: session.id,
      p_stripe_payment_intent_id: paymentIntentId,
      p_stripe_customer_id: stripeId(session.customer)!,
      p_paid_at: paidAt,
    })
    .single<FulfilledPmlePass>();
  if (error) throw error;
  if (
    !pass ||
    pass.user_id !== session.metadata!.user_id ||
    pass.stripe_payment_intent_id !== paymentIntentId
  )
    throw new Error("Pass ownership mismatch");
  return { pass, refunded: Boolean(pass.refunded_at || payment.refunded || current.refunded) };
}

/** Shared by signed webhooks and authenticated return reconciliation. */
export async function fulfillCheckoutSession(
  stripe: StripeService,
  db: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const result = await grantPmlePass(stripe, db, session);
  // Receipt ownership and refund state are derived under the payment-intent lock.
  const { error } = await db.rpc("record_pmle_pass_payment", {
    p_stripe_payment_intent_id: stripeId(session.payment_intent),
    p_amount: session.amount_total ?? 0,
    p_currency: session.currency ?? "usd",
  });
  if (error) throw error;
  if (!result.refunded) {
    // Atomic claim across return/webhook races. Analytics remains best effort:
    // a crash after this claim can lose an event, but cannot affect paid access.
    const { data: claimed, error: claimError } = await db.from("pmle_passes")
      .update({ purchase_completed_at: new Date().toISOString() })
      .eq("id", result.pass.id).eq("user_id", session.metadata!.user_id)
      .eq("stripe_checkout_session_id", session.id).is("refunded_at", null).is("purchase_completed_at", null)
      .select("id").maybeSingle();
    if (claimError) throw claimError;
    if (claimed) {
      try { after(() => trackPurchaseCompleted(session.id, result.pass.user_id, session.metadata, { amountTotal: session.amount_total, currency: session.currency })); }
      catch { /* Missing analytics scheduling context must not affect paid access. */ }
    }
  }
  return result;
}
