import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { authBody, authResponse, authErrorResponse, AUTH_MESSAGES } from "@/lib/auth/errors";
import { getVerifiedUser } from "@/lib/auth/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const data = await authBody(request, resetPasswordSchema);
    const supabase = await createServerSupabaseClient();
    const user = await getVerifiedUser(supabase);
    if (!user) return authResponse({ error: AUTH_MESSAGES.unauthenticated }, 401);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) return authResponse({ error: AUTH_MESSAGES.unavailable }, 400);
    return authResponse({ message: "Your password has been updated.", href: "/dashboard" });
  } catch (error) { return authErrorResponse(error); }
}
