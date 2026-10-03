import { getPaidAccess, isActivePass, isValidPass } from "@/lib/billing/paid-access";
import { billingUser, billingJson, billingErrorResponse } from "@/lib/billing/http";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await billingUser();
    const ids = new URL(request.url).searchParams.getAll("session_id");
    if (ids.length !== 1 || !/^cs_[A-Za-z0-9_]{1,240}$/.test(ids[0])) throw new DiagnosticError(400, "A valid checkout session is required");
    const db = createServiceSupabaseClient();
    const now = Date.now();
    const access = await getPaidAccess(user.id, db, now);
    if (access.unavailable) throw new DiagnosticError(503, "Billing is unavailable. Please try again.");
    const { data, error } = await db.from("pmle_passes")
      .select("id, paid_at, expires_at, refunded_at").eq("user_id", user.id).eq("stripe_checkout_session_id", ids[0]).maybeSingle();
    if (error) throw error;
    if (!data) return billingJson({ status: "processing", accessUntil: null });
    if (!isValidPass(data)) throw new Error("Invalid pass metadata");
    return billingJson({ status: data.refunded_at !== null ? "refunded" : access.hasPaidAccess && isActivePass(data, now) ? "active" : "expired", accessUntil: data.expires_at });
  } catch (error) { return billingErrorResponse(error); }
}
