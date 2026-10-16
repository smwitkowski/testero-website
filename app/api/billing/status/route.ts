import { getPaidAccess, isActivePass, isValidPass } from "@/lib/billing/paid-access";
import { billingUser, billingJson, billingErrorResponse } from "@/lib/billing/http";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { StripeService } from "@/lib/stripe/stripe-service";
import { fulfillCheckoutSession, isPaidPassSession } from "@/lib/stripe/pmle-pass";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await billingUser();
    const ids = new URL(request.url).searchParams.getAll("session_id");
    if (ids.length !== 1 || !/^cs_[A-Za-z0-9_]{1,240}$/.test(ids[0])) throw new DiagnosticError(400, "A valid checkout session is required");
    const db = createServiceSupabaseClient();
    let now = Date.now();
    let access = await getPaidAccess(user.id, db, now);
    if (access.unavailable) throw new DiagnosticError(503, "Billing is unavailable. Please try again.");
    const { data: existing, error } = await db.from("pmle_passes")
      .select("id, paid_at, expires_at, refunded_at, stripe_payment_intent_id, purchase_completed_at").eq("user_id", user.id).eq("stripe_checkout_session_id", ids[0]).maybeSingle();
    if (error) throw error;
    let data = existing;
    let needsFulfillment = !data;
    if (data) {
      // A previous request may have granted access before its receipt write failed.
      const { data: receipt, error: receiptError } = await db.from("payment_history")
        .select("id").eq("user_id", user.id).eq("stripe_payment_intent_id", data.stripe_payment_intent_id).maybeSingle();
      if (receiptError) throw receiptError;
      needsFulfillment = !receipt || (data.refunded_at === null && data.purchase_completed_at === null);
    }
    if (needsFulfillment) {
      // At most one Checkout retrieve per request; normal polls with a durable
      // pass and receipt do not contact Stripe. Never trust browser metadata.
      const stripe = new StripeService();
      const session = await stripe.retrieveCheckoutSession(ids[0]);
      if (session.id !== ids[0]) throw new Error("Checkout identity mismatch");
      if (session.metadata?.user_id !== user.id || !isPaidPassSession(session))
        return billingJson({ status: "processing", accessUntil: null });
      await fulfillCheckoutSession(stripe, db, session);
      const { data: fulfilled, error: fulfilledError } = await db.from("pmle_passes")
        .select("id, paid_at, expires_at, refunded_at, stripe_payment_intent_id, purchase_completed_at")
        .eq("user_id", user.id).eq("stripe_checkout_session_id", ids[0]).single();
      if (fulfilledError) throw fulfilledError;
      data = fulfilled;
      now = Date.now();
      access = await getPaidAccess(user.id, db, now);
      if (access.unavailable) throw new DiagnosticError(503, "Billing is unavailable. Please try again.");
    }
    if (!data) return billingJson({ status: "processing", accessUntil: null });
    if (!isValidPass(data)) throw new Error("Invalid pass metadata");
    return billingJson({ status: data.refunded_at !== null ? "refunded" : access.hasPaidAccess && isActivePass(data, now) ? "active" : "expired", accessUntil: data.expires_at });
  } catch (error) { return billingErrorResponse(error); }
}
