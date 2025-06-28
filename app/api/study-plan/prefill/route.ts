import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAnonymousSessionIdFromCookie } from '@/lib/auth/anonymous-session-server';

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient();
  try {
    const { searchParams } = new URL(req.url);
    const diagnosticId = searchParams.get('diagnosticId');
    const clientAnonId = searchParams.get('anonymousSessionId');

    if (!diagnosticId) {
      return NextResponse.json({ error: 'Diagnostic ID required' }, { status: 400 });
    }

    const cookieAnonId = await getAnonymousSessionIdFromCookie();
    const anonId = clientAnonId || cookieAnonId;

    const { data: { user } } = await supabase.auth.getUser();

    const { data: session, error: sessionError } = await supabase
      .from('diagnostics_sessions')
      .select('id, user_id, anonymous_session_id, completed_at')
      .eq('id', diagnosticId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Diagnostic not found' }, { status: 404 });
    }

    if (!session.completed_at) {
      return NextResponse.json({ error: 'Diagnostic not completed' }, { status: 400 });
    }

    if (session.user_id) {
      if (!user || session.user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else {
      if (session.anonymous_session_id && anonId !== session.anonymous_session_id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const { data: questions, error: qError } = await supabase
      .from('diagnostic_questions')
      .select('original_question_id, diagnostic_responses(is_correct)')
      .eq('session_id', diagnosticId);

    if (qError) {
      console.error('Error fetching diagnostic questions', qError);
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
    }

    const originalIds = questions.map(q => q.original_question_id).filter(Boolean);
    const { data: topics } = await supabase
      .from('questions')
      .select('id, topic')
      .in('id', originalIds);

    const domainStats: Record<string, { correct: number; total: number }> = {};
    questions.forEach(q => {
      const topic = topics?.find(t => t.id === q.original_question_id)?.topic || 'General';
      if (!domainStats[topic]) {
        domainStats[topic] = { correct: 0, total: 0 };
      }
      domainStats[topic].total++;
      if (q.diagnostic_responses?.[0]?.is_correct) {
        domainStats[topic].correct++;
      }
    });

    const domainBreakdown = Object.entries(domainStats).map(([domain, stats]) => ({
      domain,
      correct: stats.correct,
      total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100)
    }));

    const recommendedFocusAreas = domainBreakdown
      .filter(d => d.percentage < 70)
      .map(d => d.domain);

    return NextResponse.json({ domainBreakdown, recommendedFocusAreas });
  } catch (err) {
    console.error('study plan prefill error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
