import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getExamReadinessTier, type ExamReadinessTier } from '@/lib/readiness';

// Map examKey to exam_id
const EXAM_KEY_TO_ID: Record<string, number> = {
  pmle: 6,
};

export interface ExamReadinessSummary {
  examKey: string;
  currentReadinessScore: number;
  currentReadinessTier: ExamReadinessTier | null;
  lastDiagnosticDate: string | null;
  lastDiagnosticSessionId: string | null;
  totalDiagnosticsCompleted: number;
  hasCompletedDiagnostic: boolean;
}

export interface DashboardSummarySuccessResponse {
  status: 'ok';
  data: ExamReadinessSummary;
}

export interface ErrorResponse {
  error: string;
}

export type ResponseBody = DashboardSummarySuccessResponse | ErrorResponse;

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient();

  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to access dashboard data.' 
      } as ErrorResponse, { status: 401 });
    }

    // Parse examKey from query params
    const { searchParams } = new URL(req.url);
    const examKey = searchParams.get('examKey');

    if (!examKey) {
      return NextResponse.json({ 
        error: 'examKey query parameter is required.' 
      } as ErrorResponse, { status: 400 });
    }

    // Validate examKey
    if (!(examKey in EXAM_KEY_TO_ID)) {
      return NextResponse.json({ 
        error: `Unsupported exam key: ${examKey}. Only 'pmle' is currently supported.` 
      } as ErrorResponse, { status: 400 });
    }

    const examId = EXAM_KEY_TO_ID[examKey];

    // Query for completed PMLE diagnostics for this user
    // First, get count of all completed diagnostics for this exam
    const { count: totalCount, error: countError } = await supabase
      .from('diagnostics_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('exam_id', examId)
      .not('completed_at', 'is', null);

    if (countError) {
      console.error('Error fetching diagnostic count:', countError);
      return NextResponse.json({ 
        error: 'Failed to fetch diagnostic data.' 
      } as ErrorResponse, { status: 500 });
    }

    const totalDiagnosticsCompleted = totalCount || 0;

    // If no completed diagnostics, return empty state
    if (totalDiagnosticsCompleted === 0) {
      return NextResponse.json({
        status: 'ok',
        data: {
          examKey,
          currentReadinessScore: 0,
          currentReadinessTier: null,
          lastDiagnosticDate: null,
          lastDiagnosticSessionId: null,
          totalDiagnosticsCompleted: 0,
          hasCompletedDiagnostic: false,
        },
      } as DashboardSummarySuccessResponse);
    }

    // Fetch the latest completed diagnostic session
    const { data: latestSession, error: sessionError } = await supabase
      .from('diagnostics_sessions')
      .select('id, completed_at, question_count')
      .eq('user_id', user.id)
      .eq('exam_id', examId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching latest diagnostic session:', sessionError);
      return NextResponse.json({ 
        error: 'Failed to fetch diagnostic data.' 
      } as ErrorResponse, { status: 500 });
    }

    if (!latestSession) {
      // This shouldn't happen if count > 0, but handle gracefully
      return NextResponse.json({
        status: 'ok',
        data: {
          examKey,
          currentReadinessScore: 0,
          currentReadinessTier: null,
          lastDiagnosticDate: null,
          lastDiagnosticSessionId: null,
          totalDiagnosticsCompleted,
          hasCompletedDiagnostic: false,
        },
      } as DashboardSummarySuccessResponse);
    }

    // Fetch diagnostic responses for the latest session to calculate score
    const { data: diagnosticResponses, error: responsesError } = await supabase
      .from('diagnostic_responses')
      .select('is_correct')
      .eq('session_id', latestSession.id);

    if (responsesError) {
      console.error('Error fetching diagnostic responses:', responsesError);
      return NextResponse.json({ 
        error: 'Failed to fetch diagnostic responses.' 
      } as ErrorResponse, { status: 500 });
    }

    // Calculate score
    const totalQuestions = diagnosticResponses?.length || latestSession.question_count || 0;
    const correctAnswers = diagnosticResponses?.filter(r => r.is_correct).length || 0;
    const score = totalQuestions > 0 
      ? Math.round((correctAnswers / totalQuestions) * 100) 
      : 0;

    // Get readiness tier
    const tier = getExamReadinessTier(score);

    return NextResponse.json({
      status: 'ok',
      data: {
        examKey,
        currentReadinessScore: score,
        currentReadinessTier: tier,
        lastDiagnosticDate: latestSession.completed_at,
        lastDiagnosticSessionId: latestSession.id,
        totalDiagnosticsCompleted,
        hasCompletedDiagnostic: true,
      },
    } as DashboardSummarySuccessResponse);

  } catch (error) {
    console.error('Dashboard summary API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    } as ErrorResponse, { status: 500 });
  }
}



