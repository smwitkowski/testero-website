import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/auth/validation";
import { authBody, authResponse, authErrorResponse, AUTH_MESSAGES } from "@/lib/auth/errors";
import { getVerifiedUser, claimVerifiedDiagnostics } from "@/lib/auth/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const data = await authBody(request, loginSchema);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
    if (error) return authResponse({ error: AUTH_MESSAGES.credentials }, 401);
    const user = await getVerifiedUser(supabase);
    if (!user) return authResponse({ error: AUTH_MESSAGES.credentials }, 401);
    await claimVerifiedDiagnostics(user);
    return authResponse({ message: "Signed in.", href: data.next });
  } catch (error) { return authErrorResponse(error); }
}
