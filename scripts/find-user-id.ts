/**
 * Find user ID by email address
 * 
 * This script queries the Supabase auth.users table to find a user's ID by their email.
 * 
 * Usage:
 *   npx tsx scripts/find-user-id.ts stephen.witkowski@pm.me
 * 
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/find-user-id.ts <email>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function findUserByEmail(email: string) {
  console.log(`\n🔍 Searching for user: ${email}\n`);

  // Use the admin API to list users
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error querying users:', error.message);
    process.exit(1);
  }

  const user = data.users.find(u => u.email === email);

  if (!user) {
    console.error(`❌ No user found with email: ${email}`);
    process.exit(1);
  }

  console.log('✅ User found!\n');
  console.log('📋 User Details:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);
  console.log('  Created:', user.created_at);
  console.log('  Email Confirmed:', user.email_confirmed_at ? 'Yes' : 'No');
  
  console.log('\n📝 To set as admin, add this to your environment:\n');
  console.log(`  ADMIN_USER_IDS=${user.id}`);
  console.log('\n🚀 For Cloud Run deployment, run:\n');
  console.log(`  gcloud run services update testero-frontend \\`);
  console.log(`    --region us-central1 \\`);
  console.log(`    --update-env-vars ADMIN_USER_IDS=${user.id}\n`);
}

findUserByEmail(email);
