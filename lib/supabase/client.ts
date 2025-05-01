import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-supabase-url.supabase.co';
const supabaseKey = 'your-supabase-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseKey);
}
