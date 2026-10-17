import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resendSchema } from "@/lib/auth/validation";
import { authBody, authResponse, authErrorResponse, AUTH_MESSAGES } from "@/lib/auth/errors";
import { requestOrigin } from "@/lib/auth/redirects";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const data = await authBody(request, resendSchema);
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.resend({ type: "signup", email: data.email, options: {
        emailRedirectTo: `${requestOrigin(request)}/auth/confirm?next=${encodeURIComponent(data.next)}&flow=signup`,
      } });
    } catch { /* Unknown, confirmed and rate-limited addresses get the same response. */ }
    return authResponse({ message: AUTH_MESSAGES.resend });
  } catch (error) { return authErrorResponse(error); }
}
