import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase client authenticated with the service role key.
 * This should only be used in secure server contexts (API routes, server actions).
 */
export function createServiceSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
