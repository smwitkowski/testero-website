import "server-only";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { claimAnonymousDiagnostics } from "@/lib/auth/claim";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { ANONYMOUS_COOKIE, hashAnonymousToken } from "@/lib/diagnostic/ownership";
type AuthClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
/** A cookie or signUp response is not identity. Only a confirmed getUser result is. */
export async function getVerifiedUser(client?: AuthClient): Promise<User | null> {
  try {
    const supabase = client ?? await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && user?.email_confirmed_at ? user : null;
  } catch { return null; }
}
export async function claimVerifiedDiagnostics(user: User): Promise<void> {
  if (!user.email_confirmed_at) return;
  const cookieStore = await cookies();
  const token = cookieStore.get(ANONYMOUS_COOKIE)?.value ?? null;
  if (!hashAnonymousToken(token)) return;
  await claimAnonymousDiagnostics(createServiceSupabaseClient(), user.id, token);
}
