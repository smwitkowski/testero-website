import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Types for better type safety
export interface DiagnosticSessionSummary {
  id: string;
  examType: string;
  score: number;
  completedAt: string;
  totalQuestions: number;
  correctAnswers: number;
}

export interface PracticeStatsSummary {
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracyPercentage: number;
  lastPracticeDate: string | null;
}

export interface DashboardData {
  diagnostic: {
    recentSessions: DiagnosticSessionSummary[];
    totalSessions: number;
  };
  practice: PracticeStatsSummary;
  readinessScore: number;
}

export interface SuccessResponse {
  status: 'ok';
  data: DashboardData;
}

export interface ErrorResponse {
  error: string;
}

export type ResponseBody = SuccessResponse | ErrorResponse;

function calculateReadinessScore(
  diagnosticScore: number | null,
  practiceAccuracy: number | null
): number {
  // MVP formula: 60% diagnostic weight, 40% practice weight
  if (diagnosticScore !== null && practiceAccuracy !== null) {
    return Math.round(0.6 * diagnosticScore + 0.4 * practiceAccuracy);
  }
  
  // Fallback to available data
  if (diagnosticScore !== null) {
    return Math.round(diagnosticScore * 0.8); // Slightly discounted without practice
  }
  
  if (practiceAccuracy !== null) {
    return Math.round(practiceAccuracy * 0.7); // Discounted without diagnostic
  }
  
  // No data available
  return 0;
}

export async function GET() {
  const supabase = createServerSupabaseClient();

  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to access dashboard data.' 
      }, { status: 401 });
    }

    // Fetch diagnostic sessions data
    const { data: diagnosticSessions, error: diagnosticError } = await supabase
      .from('diagnostics_sessions')
      .select('id, exam_type, question_count, started_at, completed_at')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(10); // Fetch last 10 for calculations, show top 3 in UI

    if (diagnosticError) {
      console.error('Error fetching diagnostic sessions:', diagnosticError);
      return NextResponse.json({ 
        error: 'Failed to fetch diagnostic data.' 
      }, { status: 500 });
    }

    // Fetch diagnostic responses for completed sessions to calculate scores
    const diagnosticSessionIds = diagnosticSessions?.map(s => s.id) || [];
    let diagnosticSummaries: DiagnosticSessionSummary[] = [];
    let avgDiagnosticScore: number | null = null;

    if (diagnosticSessionIds.length > 0) {
      const { data: diagnosticResponses, error: responsesError } = await supabase
        .from('diagnostic_responses')
        .select('session_id, is_correct')
        .in('session_id', diagnosticSessionIds);

      if (responsesError) {
        console.error('Error fetching diagnostic responses:', responsesError);
      } else {
        // Calculate scores for each session
        const responsesBySession = diagnosticResponses?.reduce((acc, response) => {
          if (!acc[response.session_id]) {
            acc[response.session_id] = { correct: 0, total: 0 };
          }
          acc[response.session_id].total++;
          if (response.is_correct) {
            acc[response.session_id].correct++;
          }
          return acc;
        }, {} as Record<string, { correct: number; total: number }>) || {};

        diagnosticSummaries = diagnosticSessions?.map(session => {
          const sessionStats = responsesBySession[session.id] || { correct: 0, total: session.question_count };
          const score = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
          
          return {
            id: session.id,
            examType: session.exam_type,
            score: score,
            completedAt: session.completed_at,
            totalQuestions: sessionStats.total,
            correctAnswers: sessionStats.correct,
          };
        }) || [];

        // Calculate average diagnostic score for readiness calculation
        if (diagnosticSummaries.length > 0) {
          const totalScore = diagnosticSummaries.reduce((sum, session) => sum + session.score, 0);
          avgDiagnosticScore = totalScore / diagnosticSummaries.length;
        }
      }
    }

    // Fetch practice statistics from practice_attempts table
    // Use count queries for efficiency (no need to fetch all rows)
    // Leverages practice_attempts_user_answered_at_idx index for optimal performance
    // Count queries compute totals across all attempts but only return the count, not the data
    const { count: totalAttempts, error: totalError } = await supabase
      .from('practice_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Error handling: log but don't fail (graceful degradation)
    // If practice queries fail, we'll return zero stats rather than breaking the dashboard
    if (totalError) {
      console.error('Error fetching practice attempts count:', totalError);
    }

    const { count: correctAttempts, error: correctError } = await supabase
      .from('practice_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_correct', true);

    if (correctError) {
      console.error('Error fetching correct practice attempts count:', correctError);
    }

    // Fetch last practice date (latest answered_at)
    // Uses limit(1) with maybeSingle() to fetch only the most recent attempt's timestamp
    // This query leverages the practice_attempts_user_answered_at_idx index
    const { data: lastRow, error: lastDateError } = await supabase
      .from('practice_attempts')
      .select('answered_at')
      .eq('user_id', user.id)
      .order('answered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastDateError) {
      console.error('Error fetching last practice date:', lastDateError);
    }

    // Calculate practice statistics
    const total = totalAttempts || 0;
    const correct = correctAttempts || 0;
    const practiceAccuracy = total > 0 
      ? Math.round((correct / total) * 100) 
      : 0;
    const lastPracticeDate = lastRow?.answered_at ?? null;

    const practiceStats: PracticeStatsSummary = {
      totalQuestionsAnswered: total,
      correctAnswers: correct,
      accuracyPercentage: practiceAccuracy,
      lastPracticeDate: lastPracticeDate,
    };

    // Calculate readiness score
    const readinessScore = calculateReadinessScore(
      avgDiagnosticScore, 
      total > 0 ? practiceAccuracy : null
    );

    // Prepare response
    const dashboardData: DashboardData = {
      diagnostic: {
        recentSessions: diagnosticSummaries.slice(0, 3), // Show only top 3 in UI
        totalSessions: diagnosticSessions?.length || 0,
      },
      practice: practiceStats,
      readinessScore: readinessScore,
    };

    return NextResponse.json({ 
      status: 'ok',
      data: dashboardData 
    } as SuccessResponse);

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}