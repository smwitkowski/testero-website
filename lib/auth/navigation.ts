import "server-only";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Navigation only. Anonymous diagnostic cookies never imply a signed-in account. */
export async function hasVerifiedNavigationSession(): Promise<boolean> {
  const cookieStore = await cookies();
  if (!cookieStore.getAll().some(cookie => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"))) return false;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key || key.includes("placeholder")) return false;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && !!user;
  } catch { return false; }
}
