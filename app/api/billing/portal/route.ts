import { requestOrigin } from "@/lib/auth/redirects";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { billingUser, billingJson, billingErrorResponse, requireEmptyBody } from "@/lib/billing/http";
import { requireSameOrigin, DiagnosticError } from "@/lib/diagnostic/http";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { StripeService } from "@/lib/stripe/stripe-service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await billingUser();
    await requireEmptyBody(request);
    const db = createServiceSupabaseClient();
    const access = await getPaidAccess(user.id, db);
    if (access.unavailable) throw new DiagnosticError(503, "Billing is unavailable. Please try again.");
    if (!access.isLegacySubscriber) throw new DiagnosticError(403, "Billing management is available for active legacy subscriptions only");
    const { data, error } = await db.from("user_subscriptions").select("stripe_customer_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (error || !data?.stripe_customer_id) throw new Error("Unavailable owned subscription customer");
    const portal = await new StripeService().createPortalSession(data.stripe_customer_id, `${requestOrigin(request)}/account`);
    if (!portal.url) throw new Error("Missing portal URL");
    return billingJson({ href: portal.url });
  } catch (error) { return billingErrorResponse(error); }
}
