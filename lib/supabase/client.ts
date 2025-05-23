import { createClient } from '@supabase/supabase-js';

// Read Supabase URL and Anon Key from environment variables
import { supabaseConfig } from './config';

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

export function createBrowserClient() {
  // Ensure variables are available in the browser context as well
  // For client-side, we can directly use supabaseConfig as it's already validated
  return createClient(supabaseConfig.url, supabaseConfig.anonKey);
}
