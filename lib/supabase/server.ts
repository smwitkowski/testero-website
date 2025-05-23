import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookieStore = await cookies();
          const cookie = cookieStore.get(name);
          console.log(`[Server Supabase] Cookie ${name}: ${cookie ? 'Present' : 'Missing'}`);
          return cookie?.value;
        },
        async set(name: string, value: string, options: any) {
          try {
            const cookieStore = await cookies();
            cookieStore.set(name, value, options);
            console.log(`[Server Supabase] Cookie ${name}: Set successfully`);
          } catch (error) {
            // The set method can fail in server components where cookies are read-only
            // This is expected behavior for API routes during authentication
            console.log(`[Server Supabase] Cookie ${name}: Set failed (expected in server components)`, error);
          }
        },
        async remove(name: string, options: any) {
          try {
            const cookieStore = await cookies();
            cookieStore.set(name, '', { ...options, maxAge: 0 });
            console.log(`[Server Supabase] Cookie ${name}: Removed successfully`);
          } catch (error) {
            console.log(`[Server Supabase] Cookie ${name}: Remove failed`, error);
          }
        },
      },
    }
  );
}
