import { billingUser, billingJson, billingErrorResponse } from "@/lib/billing/http";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await billingUser();
    const ids = new URL(request.url).searchParams.getAll("session_id");
    if (ids.length !== 1 || !/^cs_[A-Za-z0-9_]{1,240}$/.test(ids[0])) throw new DiagnosticError(400, "A valid checkout session is required");
    const { data, error } = await createServiceSupabaseClient().from("pmle_passes")
      .select("expires_at, refunded_at").eq("user_id", user.id).eq("stripe_checkout_session_id", ids[0]).maybeSingle();
    if (error) throw error;
    if (!data) return billingJson({ status: "processing", accessUntil: null });
    if (typeof data.expires_at !== "string" || !Number.isFinite(Date.parse(data.expires_at)) ||
      (data.refunded_at !== null && (typeof data.refunded_at !== "string" || !Number.isFinite(Date.parse(data.refunded_at))))) throw new Error("Invalid pass metadata");
    return billingJson({ status: data.refunded_at ? "refunded" : Date.parse(data.expires_at) > Date.now() ? "active" : "expired", accessUntil: data.expires_at });
  } catch (error) { return billingErrorResponse(error); }
}
