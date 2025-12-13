import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { serializeQuestion } from '@/lib/practice/serialize';
import { requireSubscriber } from '@/lib/auth/require-subscriber';

// Question row shape returned from Supabase with explanations inner join
type QuestionWithExplanation = {
  id: string;
  stem: string;
  explanations: Array<{ id: string }>;
};

// Sample size for question selection (used as fallback when no user context)
const QUESTION_SAMPLE_SIZE = 50;

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Parse and validate difficulty parameter from query string.
 * Returns undefined if not provided, or throws validation error.
 * Accepts text values: 'EASY', 'MEDIUM', 'HARD' (canonical schema)
 */
function parseDifficulty(difficultyStr: string | null): string | undefined {
  if (!difficultyStr) {
    return undefined;
  }
  const upperDifficulty = difficultyStr.toUpperCase();
  if (!['EASY', 'MEDIUM', 'HARD'].includes(upperDifficulty)) {
    throw new Error('Invalid difficulty (must be EASY, MEDIUM, or HARD)');
  }
  return upperDifficulty;
}

/**
 * Build select columns string based on hasExplanation flag.
 * Returns inner join when true (default), regular join when false.
 */
function selectColumns(hasExplanation: boolean): string {
  return hasExplanation 
    ? 'id, stem, explanations!inner(id)' 
    : 'id, stem, explanations(id)';
}

export async function GET(request: NextRequest) {
  try {
    // Premium gate check
    const block = await requireSubscriber(request, "/api/questions/current");
    if (block) return block;

    // Parse excludeIds from query parameters (comma-separated list)
    const excludeIdsParam = request.nextUrl.searchParams.get("excludeIds");
    const excludeIds = new Set(
      (excludeIdsParam?.split(",") || [])
        .map((id) => id.trim())
        .filter(Boolean)
    );

    // Create server-side Supabase client - user may be null if access via grace cookie
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Note: requireSubscriber ensures user is authenticated OR has valid grace cookie
    // If grace cookie allows access, user might be null

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    // Note: topic filter removed - questions table doesn't have topic column
    // Use domain_id join if topic filtering is needed in future
    const hasExplanationParam = searchParams.get('hasExplanation');
    const hasExplanation = hasExplanationParam?.toLowerCase() === 'false' ? false : true;
    
    // Validate difficulty parameter (accepts 'EASY', 'MEDIUM', 'HARD')
    let difficulty: string | undefined;
    try {
      difficulty = parseDifficulty(searchParams.get('difficulty'));
    } catch (error) {
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Invalid difficulty (must be EASY, MEDIUM, or HARD)' 
      }, { status: 400 });
    }

    // Build query with filters - always apply status='ACTIVE' and review_status='GOOD'
    let query = supabase
      .from('questions')
      .select(selectColumns(hasExplanation))
      .eq('status', 'ACTIVE')
      .eq('review_status', 'GOOD');

    // Apply optional filters with AND semantics
    if (difficulty !== undefined) {
      query = query.eq('difficulty', difficulty);
    }

    // For authenticated users, fetch their seen question IDs to exclude them
    let seenQuestionIds = new Set<string>();
    if (user) {
      const { data: seenAttempts, error: seenError } = await supabase
        .from('practice_question_attempts_v2')
        .select('question_id')
        .eq('user_id', user.id);

      if (!seenError && seenAttempts) {
        seenQuestionIds = new Set(seenAttempts.map(a => a.question_id));
      }
    }

    // Execute query - fetch all eligible questions (no limit for authenticated users with seen tracking)
    // For anonymous users, still use limit to avoid performance issues
    const fetchQuery = user ? query : query.limit(QUESTION_SAMPLE_SIZE);
    const { data: allEligibleQuestions, error: questionError } = await fetchQuery;

    if (questionError || !allEligibleQuestions || allEligibleQuestions.length === 0) {
      console.info('No eligible questions with explanations', { userId: user?.id || "anonymous" });
      return NextResponse.json({ error: 'No eligible questions with explanations.' }, { status: 404 });
    }

    // Filter out seen questions and client-side excluded IDs
    const remainingQuestions = allEligibleQuestions.filter((q) => {
      const questionId = String((q as unknown as QuestionWithExplanation).id);
      return !seenQuestionIds.has(questionId) && !excludeIds.has(questionId);
    });

    // If pool is exhausted (authenticated user has seen all eligible questions)
    if (user && remainingQuestions.length === 0) {
      // Auto-reset: allow repeats by selecting from all eligible questions
      // In the future, could add a "reset" endpoint or cycle tracking
      const resetQuestions = allEligibleQuestions.filter((q) => {
        const questionId = String((q as unknown as QuestionWithExplanation).id);
        return !excludeIds.has(questionId);
      });

      if (resetQuestions.length === 0) {
        return NextResponse.json(
          { error: 'No eligible questions available given exclusions.' },
          { status: 404 }
        );
      }

      // Random selection from reset pool
      const randomIndex = Math.floor(Math.random() * resetQuestions.length);
      const question = resetQuestions[randomIndex] as unknown as QuestionWithExplanation;

      // Record as "seen" immediately to prevent rapid refreshes from re-serving
      // Ignore errors (e.g., duplicate key from race conditions)
      const { error: seenInsertError } = await supabase
        .from('practice_question_attempts_v2')
        .insert({ user_id: user.id, question_id: question.id });
      
      if (seenInsertError) {
        // Ignore duplicate key errors or other insert failures (race conditions are OK)
        // Log only for debugging unexpected errors
        if (!seenInsertError.message?.includes('duplicate') && !seenInsertError.code?.includes('23505')) {
          console.debug('practice_question_attempts_v2 insert warning:', seenInsertError.message);
        }
      }

      // Fetch answers for the question
      const { data: answers, error: answersError } = await supabase
        .from('answers')
        .select('id, choice_label, choice_text')
        .eq('question_id', question.id);

      if (answersError) {
        return NextResponse.json({ error: 'Error fetching answers.' }, { status: 500 });
      }

      // Shuffle answers to randomize option order
      const shuffledAnswers = shuffleArray(answers || []);

      return NextResponse.json(serializeQuestion(question, shuffledAnswers));
    }

    // If no remaining questions after filtering (shouldn't happen for anonymous, but handle gracefully)
    if (remainingQuestions.length === 0) {
      return NextResponse.json(
        { error: 'No eligible questions available given exclusions.' },
        { status: 404 }
      );
    }

    // Random selection from remaining pool
    const randomIndex = Math.floor(Math.random() * remainingQuestions.length);
    const question = remainingQuestions[randomIndex] as unknown as QuestionWithExplanation;

    // For authenticated users, record as "seen" immediately to prevent rapid refreshes from re-serving
    // Ignore errors (e.g., duplicate key from race conditions)
    if (user) {
      const { error: seenInsertError } = await supabase
        .from('practice_question_attempts_v2')
        .insert({ user_id: user.id, question_id: question.id });
      
      if (seenInsertError) {
        // Ignore duplicate key errors or other insert failures (race conditions are OK)
        // Log only for debugging unexpected errors
        if (!seenInsertError.message?.includes('duplicate') && !seenInsertError.code?.includes('23505')) {
          console.debug('practice_question_attempts_v2 insert warning:', seenInsertError.message);
        }
      }
    }

    // Fetch answers for the question (canonical schema uses 'answers' table)
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select('id, choice_label, choice_text')
      .eq('question_id', question.id);

    if (answersError) {
      return NextResponse.json({ error: 'Error fetching answers.' }, { status: 500 });
    }

    // Shuffle answers to randomize option order
    const shuffledAnswers = shuffleArray(answers || []);

    // Shape the response (serializeQuestion will map choice_label->label, choice_text->text)
    return NextResponse.json(serializeQuestion(question, shuffledAnswers));
  } catch (error) {
    console.error('Current question API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 