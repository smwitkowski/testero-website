import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';

export function createServerSupabaseClient() {
  return createServerClient(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        async get(name: string) {
          const cookieStore = await cookies();
          const cookie = cookieStore.get(name);
          console.log(`[Server Supabase] Cookie ${name}: ${cookie ? 'Present' : 'Missing'}`);
          return cookie?.value;
        },
      },
    }
  );
}
