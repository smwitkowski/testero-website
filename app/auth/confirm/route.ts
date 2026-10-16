import { scheduleFunnelEvent } from "@/lib/analytics/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedUser, claimVerifiedDiagnostics } from "@/lib/auth/session";
import { confirmationSchema } from "@/lib/auth/validation";
import { confirmationNext, requestOrigin, signupDestination } from "@/lib/auth/redirects";
export const runtime = "nodejs";
function destination(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, requestOrigin(request)), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export async function GET(request: Request) {
  let failedFlow: string | undefined;
  // An expired reset link leads to a new reset request; any other failure offers a new confirmation email.
  const invalid = () => destination(request, failedFlow === "recovery" ? "/forgot-password?message=confirmation-failed" : "/login?message=confirmation-failed");
  try {
    const params = new URL(request.url).searchParams;
    failedFlow = params.get("type") ?? params.get("flow") ?? undefined;
    if ([...params.keys()].some(key => params.getAll(key).length !== 1)) return invalid();
    const parsed = confirmationSchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) return invalid();
    const data = parsed.data;
    const supabase = await createServerSupabaseClient();
    const { error } = data.code
      ? await supabase.auth.exchangeCodeForSession(data.code)
      : await supabase.auth.verifyOtp({ token_hash: data.token_hash!, type: data.type! });
    if (error) return invalid();
    const user = await getVerifiedUser(supabase);
    if (!user) return invalid();
    const flow = data.type ?? data.flow;
    if (flow === "recovery") return destination(request, "/reset-password");
    await claimVerifiedDiagnostics(user);
    if (flow === "signup") scheduleFunnelEvent(request, "signup_completed", user.id, {}, `signup_completed:${user.id}`);
    return destination(request, flow === "signup" ? signupDestination(confirmationNext(data.redirect_to, requestOrigin(request), data.next)) : data.next);
  } catch { return invalid(); }
}
