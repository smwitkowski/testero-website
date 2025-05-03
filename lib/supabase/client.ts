import { createClient } from '@supabase/supabase-js';

// Read Supabase URL and Anon Key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 
// Basic validation
if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export function createBrowserClient() {
  // Ensure variables are available in the browser context as well
  const browserSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const browserSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  if (!browserSupabaseUrl || !browserSupabaseKey) {
    console.error("Supabase URL or Key missing in browser environment.");
    // Depending on your error handling strategy, you might throw an error 
    // or return a non-functional client. For now, let's proceed but log error.
  }

  return createClient(browserSupabaseUrl, browserSupabaseKey);
}
