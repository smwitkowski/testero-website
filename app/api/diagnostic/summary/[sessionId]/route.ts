import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireSubscriber } from '@/lib/auth/require-subscriber';
import { getPmleDomainConfig } from '@/lib/constants/pmle-blueprint';

// Types for diagnostic questions with responses
interface DiagnosticResponse {
  selected_label: string;
  is_correct: boolean;
  responded_at: string;
}

interface DiagnosticQuestionWithResponse {
  id: string;
  stem: string;
  options: Array<{ label: string; text: string }>;
  correct_label: string;
  canonical_question_id: string | null;
  original_question_id: string | null;
  domain_code: string | null;
  domain_id: string | null;
  diagnostic_responses: DiagnosticResponse[] | null;
}


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

    // Authorization check (must happen before expiration check for proper error handling)
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
      // For incomplete sessions, check expiration - expired incomplete sessions cannot be accessed
      if (dbSession.expires_at && new Date(dbSession.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Session expired' }, { status: 410 });
      }
      return NextResponse.json({ error: 'Session not completed yet' }, { status: 400 });
    }

    // For completed sessions, allow access regardless of expiration time
    // This allows users to review their completed diagnostic results indefinitely

    // Fetch diagnostic questions (snapshots) with responses and domain info
    const { data: questionsWithResponses, error: questionsError } = await supabase
      .from('diagnostic_questions')
      .select(`
        id,
        stem,
        options,
        correct_label,
        canonical_question_id,
        original_question_id,
        domain_code,
        domain_id,
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

    // Calculate domain breakdown entirely from snapshot domain_code and diagnostic_responses
    // Domain breakdown is computed directly from diagnostic_questions.domain_code with no legacy questions joins
    const domainStats: { [key: string]: { correct: number; total: number } } = {};
    
    // Type assertion for the query result
    const typedQuestions = questionsWithResponses as DiagnosticQuestionWithResponse[];
    
    // Compute domain breakdown from snapshot domain_code only
    // Filter to only questions with domain_code (canonical sessions)
    typedQuestions
      .filter((q) => q.domain_code) // Only process questions with domain_code
      .forEach((q) => {
        // Get human-readable domain name from blueprint config
        const domainCode = q.domain_code!; // Safe because we filtered above
        const domainConfig = getPmleDomainConfig(domainCode);
        const domain = domainConfig?.displayName || domainCode;
        
        if (!domainStats[domain]) {
          domainStats[domain] = { correct: 0, total: 0 };
        }
        
        domainStats[domain].total++;
        if (q.diagnostic_responses?.[0]?.is_correct) {
          domainStats[domain].correct++;
        }
      });
    
    // For non-canonical or older sessions where domain_code is null for all questions,
    // domainBreakdown will be empty (no domain breakdown available)

    const domainBreakdown = Object.entries(domainStats).map(([domain, stats]) => ({
      domain,
      correct: stats.correct,
      total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100)
    }));

    // Fetch canonical explanations in bulk
    // Primary path: Use canonical_question_id (UUID) for PMLE canonical sessions
    // Fallback path: Use original_question_id (bigint) for legacy sessions
    const canonicalQuestionIds = typedQuestions
      .map((q) => q.canonical_question_id)
      .filter((id): id is string => id !== null && id !== undefined);

    const originalQuestionIds = typedQuestions
      .map((q) => q.original_question_id)
      .filter((id): id is string => id !== null && id !== undefined);

    let explanationByCanonicalId: Record<string, string> = {};
    let explanationByOriginalId: Record<string, string> = {};

    // Fetch explanations via canonical_question_id (primary path for PMLE)
    if (canonicalQuestionIds.length > 0) {
      const { data: canonicalExplanations, error: canonicalExplanationsError } = await supabase
        .from('explanations')
        .select('question_id, explanation_text')
        .in('question_id', canonicalQuestionIds);

      if (canonicalExplanationsError) {
        console.error('Error fetching canonical explanations for summary:', canonicalExplanationsError);
        // Continue without explanations rather than failing the entire request
      } else if (canonicalExplanations) {
        // Build lookup map: question_id (UUID string) -> explanation_text
        explanationByCanonicalId = Object.fromEntries(
          canonicalExplanations.map((e: { question_id: string; explanation_text: string }) => [
            e.question_id,
            e.explanation_text,
          ])
        );
      }
    }

    // Fetch explanations via original_question_id (fallback for legacy sessions)
    if (originalQuestionIds.length > 0) {
      // Convert all IDs to strings for consistent lookup
      const questionIdStrings = originalQuestionIds.map((id) => String(id));

      const { data: legacyExplanations, error: legacyExplanationsError } = await supabase
        .from('explanations')
        .select('question_id, explanation_text')
        .in('question_id', questionIdStrings);

      if (legacyExplanationsError) {
        console.error('Error fetching legacy explanations for summary:', legacyExplanationsError);
        // Continue without explanations rather than failing the entire request
      } else if (legacyExplanations) {
        // Build lookup map: question_id (as string) -> explanation_text
        explanationByOriginalId = Object.fromEntries(
          legacyExplanations.map((e: { question_id: string | number; explanation_text: string }) => [
            String(e.question_id),
            e.explanation_text,
          ])
        );
      }
    }

    // Format questions for client, including explanations
    const questions = typedQuestions.map(q => {
      let explanation: string | null = null;

      // Primary path: Use canonical_question_id for PMLE canonical sessions
      if (q.canonical_question_id) {
        explanation = explanationByCanonicalId[q.canonical_question_id] ?? null;
        
        // Log warning if canonical_question_id is set but no explanation was found
        if (explanation === null) {
          console.warn(
            `Summary missing explanation for canonical question ${q.canonical_question_id} in session ${sessionId}`
          );
        }
      }
      // Fallback path: Use original_question_id for legacy sessions
      else if (q.original_question_id) {
        explanation = explanationByOriginalId[String(q.original_question_id)] ?? null;

        // Log warning if original_question_id is set but no explanation was found
        if (explanation === null) {
          console.warn(
            `Summary missing explanation for legacy question ${q.original_question_id} in session ${sessionId}`
          );
        }
      }

      return {
        id: q.id,
        stem: q.stem,
        options: q.options,
        userAnswer: q.diagnostic_responses?.[0]?.selected_label || '',
        correctAnswer: q.correct_label,
        isCorrect: q.diagnostic_responses?.[0]?.is_correct || false,
        explanation
      };
    });

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