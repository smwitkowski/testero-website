import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SerializeOptions } from "cookie";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.local";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export function createServerSupabaseClient() {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async get(name: string) {
        const cookieStore = await cookies();
        const cookie = cookieStore.get(name);
        return cookie?.value;
      },
      async set(name: string, value: string, options: SerializeOptions) {
        try {
          const cookieStore = await cookies();
          cookieStore.set(name, value, options);
        } catch {
          // The set method can fail in server components where cookies are read-only
          // This is expected behavior for API routes during authentication
        }
      },
      async remove(name: string, options: SerializeOptions) {
        try {
          const cookieStore = await cookies();
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        } catch {
          // Cookie removal can fail in server components where cookies are read-only
        }
      },
    },
  });
}
