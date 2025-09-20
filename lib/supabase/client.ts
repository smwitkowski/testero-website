import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.local";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Legacy export for backwards compatibility
export const supabase = createClient();
