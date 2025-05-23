import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, questionId, selectedLabel } = body;

    if (!sessionId || !questionId || !selectedLabel) {
      return NextResponse.json({ error: 'Missing sessionId, questionId, or selectedLabel.' }, { status: 400 });
    }

    const supabaseServer = createServerSupabaseClient();

    // Get user ID from Supabase auth
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated.' }, { status: 401 });
    }

    // 1. Fetch the diagnostic question to get the correct answer
    const { data: diagnosticQuestion, error: questionError } = await supabaseServer
      .from('diagnostic_questions')
      .select('correct_label, session_id')
      .eq('id', questionId)
      .single();

    if (questionError || !diagnosticQuestion) {
      console.error('Error fetching diagnostic question:', questionError);
      return NextResponse.json({ error: 'Diagnostic question not found.' }, { status: 404 });
    }

    // Ensure the question belongs to the provided session and authenticated user
    const { data: session, error: sessionFetchError } = await supabaseServer
      .from('diagnostics_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (sessionFetchError || !session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found or unauthorized.' }, { status: 403 });
    }

    const isCorrect = selectedLabel === diagnosticQuestion.correct_label;

    // 2. Record the response
    const { error: responseError } = await supabaseServer
      .from('diagnostic_responses')
      .insert({
        session_id: sessionId,
        question_id: questionId,
        selected_label: selectedLabel,
        is_correct: isCorrect,
      });

    if (responseError) {
      console.error('Error recording diagnostic response:', responseError);
      return NextResponse.json({ error: 'Failed to record response.' }, { status: 500 });
    }

    // 3. Return feedback
    return NextResponse.json({
      isCorrect,
      correctOptionLabel: diagnosticQuestion.correct_label,
      explanationText: `The correct answer was ${diagnosticQuestion.correct_label}. This is a placeholder explanation.`, // Placeholder explanation
    });

  } catch (error) {
    console.error('Diagnostic answer API error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
