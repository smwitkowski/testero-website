import { createServerSupabaseClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { authBody, authResponse, authErrorResponse, AUTH_MESSAGES } from "@/lib/auth/errors";
import { requestOrigin } from "@/lib/auth/redirects";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const data = await authBody(request, forgotPasswordSchema);
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.resetPasswordForEmail(data.email, { redirectTo: `${requestOrigin(request)}/auth/confirm?next=%2Freset-password&flow=recovery` });
    } catch { /* Never reveal whether an email exists, including transport errors. */ }
    return authResponse({ message: AUTH_MESSAGES.recovery });
  } catch (error) { return authErrorResponse(error); }
}
