import { requestOrigin } from "@/lib/auth/redirects";
import { createHash } from "node:crypto";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { billingUser, billingJson, billingErrorResponse, requireEmptyBody } from "@/lib/billing/http";
import { requireSameOrigin, DiagnosticError } from "@/lib/diagnostic/http";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { StripeService } from "@/lib/stripe/stripe-service";
export const runtime = "nodejs";
/** Ten-minute windows reuse checkout creation; this is not an authorization cache. */
export function checkoutIdempotencyKey(userId: string, price: string, now = Date.now()) {
  return `pmle-pass:${createHash("sha256").update(`${userId}:${price}:${Math.floor(now / 600_000)}`).digest("hex")}`;
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await billingUser();
    await requireEmptyBody(request);
    const access = await getPaidAccess(user.id, createServiceSupabaseClient());
    if (access.unavailable) throw new DiagnosticError(503, "Billing is unavailable. Please try again.");
    if (access.hasPaidAccess) return billingJson({ href: "/account", alreadyActive: true });
    const price = process.env.STRIPE_PRICE_PMLE_PASS;
    if (!price) throw new Error("Missing server pass price");
    const stripe = new StripeService();
    const customer = await stripe.createOrRetrieveCustomer(user.id);
    const origin = requestOrigin(request);
    const session = await stripe.createCheckoutSession({ customerId: customer.id, userId: user.id,
      successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${origin}/pricing`,
      idempotencyKey: checkoutIdempotencyKey(user.id, price),
    });
    if (!session.url) throw new Error("Missing checkout URL");
    return billingJson({ href: session.url });
  } catch (error) { return billingErrorResponse(error); }
}
