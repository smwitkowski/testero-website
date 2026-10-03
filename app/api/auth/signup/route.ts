import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/auth/validation";
import { authBody, authResponse, authErrorResponse, AUTH_MESSAGES } from "@/lib/auth/errors";
import { requestOrigin } from "@/lib/auth/redirects";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const data = await authBody(request, signupSchema);
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.signUp({ email: data.email, password: data.password, options: {
        emailRedirectTo: `${requestOrigin(request)}/auth/confirm?next=${encodeURIComponent(data.next)}&flow=signup`,
      } });
    } catch { /* Duplicate and unavailable signup responses are deliberately identical. */ }
    return authResponse({ message: AUTH_MESSAGES.signup });
  } catch (error) { return authErrorResponse(error); }
}
