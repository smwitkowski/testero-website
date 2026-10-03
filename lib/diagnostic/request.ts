import "server-only";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ANONYMOUS_COOKIE, type OwnerCredentials } from "@/lib/diagnostic/ownership";

export async function diagnosticCredentials(): Promise<OwnerCredentials> {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { userId: user?.id ?? null, anonymousToken: cookieStore.get(ANONYMOUS_COOKIE)?.value ?? null };
}
