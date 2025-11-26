import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { serializeQuestion } from '@/lib/practice/serialize';
import { requireSubscriber } from '@/lib/auth/require-subscriber';

export async function GET(request: NextRequest) {
  try {
    // Premium gate check
    const block = await requireSubscriber(request, "/api/questions/[id]");
    if (block) return block;

    // Extract ID from the URL path
    const pathParts = request.nextUrl.pathname.split('/');
    const questionId = pathParts[pathParts.length - 1];

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required.' }, { status: 400 });
    }

    // Create server-side Supabase client - user may be null if access via grace cookie
    const supabase = createServerSupabaseClient();
    await supabase.auth.getUser(); // Check auth state (not used but required for Supabase context)
    
    // Note: requireSubscriber ensures user is authenticated OR has valid grace cookie
    // This endpoint doesn't require user.id, so we can proceed without it

    // Fetch the question by ID
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found or database error.' }, { status: 404 });
    }

    // Fetch answers for the question (canonical schema uses 'answers' table)
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select('id, choice_label, choice_text')
      .eq('question_id', question.id);

    if (answersError) {
      return NextResponse.json({ error: 'Error fetching answers.' }, { status: 500 });
    }

    // Shape the response (serializeQuestion will map choice_label->label, choice_text->text)
    return NextResponse.json(serializeQuestion(question, answers || []));
  } catch (error) {
    console.error('Question by ID API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
