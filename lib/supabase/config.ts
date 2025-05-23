export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
} as const;

// Basic validation to ensure environment variables are loaded
if (!supabaseConfig.url || !supabaseConfig.anonKey) {
  throw new Error('Missing Supabase configuration environment variables.');
}
