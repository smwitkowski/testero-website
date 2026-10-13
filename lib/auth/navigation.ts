import "server-only";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Verified identity for navigation and analytics; anonymous cookies never imply an account. */
export async function verifiedNavigationUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  if (!cookieStore.getAll().some(cookie => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"))) return null;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key || key.includes("placeholder")) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && user?.email_confirmed_at ? user.id : null;
  } catch { return null; }
}
