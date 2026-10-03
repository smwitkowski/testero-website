import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logoutSchema } from "@/lib/auth/validation";
import { authBody, authResponse, authErrorResponse, AUTH_MESSAGES } from "@/lib/auth/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await authBody(request, logoutSchema);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return authResponse({ error: AUTH_MESSAGES.unavailable }, 503);
    return authResponse({ message: "Signed out.", href: "/" });
  } catch (error) { return authErrorResponse(error); }
}
