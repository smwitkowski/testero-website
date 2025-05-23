import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Create server-side Supabase client and check authentication
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Auth check failed in current question API:', authError?.message);
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to access questions.',
        authError: authError?.message 
      }, { status: 401 });
    }

    // Fetch the first available question (no is_active filter)
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'No question found or database error.' }, { status: 404 });
    }

    // Fetch options for the question
    const { data: options, error: optionsError } = await supabase
      .from('options')
      .select('id, label, text')
      .eq('question_id', question.id);

    if (optionsError) {
      return NextResponse.json({ error: 'Error fetching options.' }, { status: 500 });
    }

    // Shape the response
    return NextResponse.json({
      id: question.id,
      question_text: question.stem,
      options: options || [],
    });
  } catch (error) {
    console.error('Current question API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 