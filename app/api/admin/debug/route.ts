import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceSupabaseClient } from '@/lib/supabase/service';

/**
 * Debug endpoint to troubleshoot admin check issues
 * This will help identify if the user is authenticated and if the database query works
 */
export async function GET() {
  try {
    // Check if user is authenticated
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({
        error: 'Auth error',
        details: authError.message,
      }, { status: 200 });
    }

    if (!user) {
      return NextResponse.json({
        error: 'Not authenticated',
        user: null,
      }, { status: 200 });
    }

    // Try to query admin_users table
    try {
      const serviceSupabase = createServiceSupabaseClient();
      const { data, error } = await serviceSupabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      return NextResponse.json({
        authenticated: true,
        userId: user.id,
        email: user.email,
        adminQueryResult: {
          data,
          error: error ? { code: error.code, message: error.message } : null,
        },
        isAdmin: !!data,
      }, { status: 200 });
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      return NextResponse.json({
        authenticated: true,
        userId: user.id,
        email: user.email,
        dbError: errorMessage,
      }, { status: 200 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Unexpected error',
      message: errorMessage,
    }, { status: 200 });
  }
}
