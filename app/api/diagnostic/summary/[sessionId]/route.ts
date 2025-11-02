import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireSubscriber } from '@/lib/auth/require-subscriber';

export async function GET(req: Request) {
  // Premium gate check
  const block = await requireSubscriber(req, "/api/diagnostic/summary/[sessionId]");
  if (block) return block;

  const supabase = createServerSupabaseClient();
  
  try {
    // Extract session ID from the URL path
    const pathParts = new URL(req.url).pathname.split('/');
    const sessionId = pathParts[pathParts.length - 1];
    const { searchParams } = new URL(req.url);
    const anonymousSessionId = searchParams.get('anonymousSessionId');

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch session from DB
    const { data: dbSession, error: sessionError } = await supabase
      .from('diagnostics_sessions')
      .select('id, user_id, anonymous_session_id, completed_at, expires_at, exam_type, started_at, question_count')
      .eq('id', sessionId)
      .single();

    if (sessionError || !dbSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if session expired
    if (dbSession.expires_at && new Date(dbSession.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 410 });
    }

    // Authorization check
    if (dbSession.user_id) {
      // Session belongs to a logged-in user
      if (!user || dbSession.user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized to access this session' }, { status: 403 });
      }
    } else {
      // Anonymous session
      if (dbSession.anonymous_session_id && anonymousSessionId !== dbSession.anonymous_session_id) {
        return NextResponse.json({ error: 'Invalid anonymous session identifier' }, { status: 403 });
      }
    }

    // Check if session is completed
    if (!dbSession.completed_at) {
      return NextResponse.json({ error: 'Session not completed yet' }, { status: 400 });
    }

    // Fetch diagnostic questions (snapshots) with responses
    const { data: questionsWithResponses, error: questionsError } = await supabase
      .from('diagnostic_questions')
      .select(`
        id,
        stem,
        options,
        correct_label,
        original_question_id,
        diagnostic_responses (
          selected_label,
          is_correct,
          responded_at
        )
      `)
      .eq('session_id', sessionId);

    if (questionsError) {
      console.error('Error fetching questions with responses:', questionsError);
      return NextResponse.json({ error: 'Failed to load session data' }, { status: 500 });
    }

    // Calculate overall statistics
    const totalQuestions = questionsWithResponses.length;
    const correctAnswers = questionsWithResponses.filter(q => 
      q.diagnostic_responses?.[0]?.is_correct
    ).length;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    // Fetch topics/domains for domain breakdown (if available)
    const originalQuestionIds = questionsWithResponses.map(q => q.original_question_id).filter(Boolean);
    const { data: questionTopics } = await supabase
      .from('questions')
      .select('id, topic')
      .in('id', originalQuestionIds);

    // Calculate domain breakdown
    const domainStats: { [key: string]: { correct: number; total: number } } = {};
    
    questionsWithResponses.forEach(q => {
      const topicData = questionTopics?.find(t => t.id === q.original_question_id);
      const domain = topicData?.topic || 'General';
      
      if (!domainStats[domain]) {
        domainStats[domain] = { correct: 0, total: 0 };
      }
      
      domainStats[domain].total++;
      if (q.diagnostic_responses?.[0]?.is_correct) {
        domainStats[domain].correct++;
      }
    });

    const domainBreakdown = Object.entries(domainStats).map(([domain, stats]) => ({
      domain,
      correct: stats.correct,
      total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100)
    }));

    // Format questions for client
    const questions = questionsWithResponses.map(q => ({
      id: q.id,
      stem: q.stem,
      options: q.options,
      userAnswer: q.diagnostic_responses?.[0]?.selected_label || '',
      correctAnswer: q.correct_label,
      isCorrect: q.diagnostic_responses?.[0]?.is_correct || false
    }));

    const summary = {
      sessionId: dbSession.id,
      examType: dbSession.exam_type,
      totalQuestions,
      correctAnswers,
      score,
      startedAt: dbSession.started_at,
      completedAt: dbSession.completed_at,
      questions
    };

    return NextResponse.json({
      summary,
      domainBreakdown
    });

  } catch (error) {
    console.error('GET diagnostic summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}