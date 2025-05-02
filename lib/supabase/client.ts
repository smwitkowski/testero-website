import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qpjsgcdrgnoinnlxzeze.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwanNnY2RyZ25vaW5ubHh6ZXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI1NjE3NDIsImV4cCI6MjAzODEzNzc0Mn0.WY_JI5_02TJakjLhq1ZgRXHo46z-njJdbfs-prqJ9jU';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseKey);
}
