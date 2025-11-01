import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Create server-side Supabase client and check authentication
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Auth check failed in questions list API:', authError?.message);
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to access questions.',
        authError: authError?.message 
      }, { status: 401 });
    }

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
