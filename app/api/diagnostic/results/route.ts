 import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId.' }, { status: 400 });
    }

    const supabaseServer = createServerSupabaseClient();

    // Get user ID from Supabase auth
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated.' }, { status: 401 });
    }

    // 1. Verify session and user
    const { data: session, error: sessionError } = await supabaseServer
      .from('diagnostics_sessions')
      .select('user_id, exam_type')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found or unauthorized.' }, { status: 403 });
    }

    // 2. Fetch all responses for the session
    const { data: responses, error: responsesError } = await supabaseServer
      .from('diagnostic_responses')
      .select('is_correct')
      .eq('session_id', sessionId);

    if (responsesError) {
      console.error('Error fetching diagnostic responses:', responsesError);
      return NextResponse.json({ error: 'Failed to fetch responses.' }, { status: 500 });
    }

    // 3. Calculate score
    const totalQuestions = responses.length;
    const correctAnswers = responses.filter(r => r.is_correct).length;
    const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // 4. Mark session as completed
    const { error: updateSessionError } = await supabaseServer
      .from('diagnostics_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (updateSessionError) {
      console.error('Error updating session completion time:', updateSessionError);
      // Don't block response, but log error
    }

    // 5. Placeholder for topic recommendations (future AI integration)
    const topicRecommendations = [
      `Based on your performance in ${session.exam_type} diagnostic, you should focus on:`,
      'Networking concepts',
      'Security best practices',
      'Compute Engine optimization',
    ];

    return NextResponse.json({
      sessionId,
      examType: session.exam_type,
      totalQuestions,
      correctAnswers,
      score: parseFloat(score.toFixed(2)),
      topicRecommendations,
    });

  } catch (error) {
    console.error('Diagnostic results API error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
