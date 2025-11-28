import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth/isAdmin';

/**
 * API endpoint to check if the current user is an admin
 * Returns { isAdmin: boolean }
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    const adminStatus = isAdmin(user);
    return NextResponse.json({ isAdmin: adminStatus }, { status: 200 });
  } catch (error) {
    console.error('[Admin Check] Error:', error);
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}

