import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { serializeQuestion } from '@/lib/practice/serialize';

export async function GET(request: NextRequest) {
  try {
    // Extract ID from the URL path
    const pathParts = request.nextUrl.pathname.split('/');
    const questionId = pathParts[pathParts.length - 1];

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required.' }, { status: 400 });
    }

    // Create server-side Supabase client and check authentication
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Auth check failed in question by ID API:', authError?.message);
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to access questions.',
        authError: authError?.message 
      }, { status: 401 });
    }

    // Fetch the question by ID
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found or database error.' }, { status: 404 });
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
    return NextResponse.json(serializeQuestion(question, options || []));
  } catch (error) {
    console.error('Question by ID API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
