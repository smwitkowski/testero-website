import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireSubscriber } from '@/lib/auth/require-subscriber';

export async function GET(request: NextRequest) {
  try {
    // Premium gate check
    const block = await requireSubscriber(request, "/api/questions");
    if (block) return block;

    // Create server-side Supabase client - user may be null if access via grace cookie
    const supabase = createServerSupabaseClient();
    await supabase.auth.getUser(); // Check auth state (not used but required for Supabase context)
    
    // Note: requireSubscriber ensures user is authenticated OR has valid grace cookie
    // This endpoint doesn't require user.id, so we can proceed without it

    // Fetch all question IDs
    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('id')
      .order('id', { ascending: true });

    if (questionError || !questions) {
      return NextResponse.json({ error: 'No questions found or database error.' }, { status: 404 });
    }

    // Return only the IDs
    const questionIds = questions.map(q => String(q.id));

    return NextResponse.json({
      questionIds,
    });
  } catch (error) {
    console.error('Questions list API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
