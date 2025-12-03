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

// Sample size for question selection
const QUESTION_SAMPLE_SIZE = 50;

/**
 * Calculate deterministic question index for rotation based on user ID and time.
 * Ensures different users get different questions and the same user gets variety over time.
 */
function calculateQuestionIndex(userId: string, questionsLength: number): number {
  const currentHour = new Date().getHours();
  const userIdHash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeSlot = Math.floor(Date.now() / (1000 * 60 * 10)); // 10-minute slots
  return (userIdHash + currentHour + timeSlot) % questionsLength;
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
    // If grace cookie allows access, user might be null, so we use a fallback for user ID
    const userIdForIndex = user?.id || "anonymous";

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

    // Execute query with limit
    const { data: questions, error: questionError } = await query.limit(QUESTION_SAMPLE_SIZE);

    if (questionError || !questions || questions.length === 0) {
      console.info('No eligible questions with explanations', { userId: user?.id || "anonymous", sampleLimit: QUESTION_SAMPLE_SIZE });
      return NextResponse.json({ error: 'No eligible questions with explanations.' }, { status: 404 });
    }

    // Use deterministic rotation to select a question, but skip excluded IDs
    const startIndex = calculateQuestionIndex(userIdForIndex, questions.length);
    let chosenIndex = -1;

    // Circular scan from deterministic start index, skipping excluded IDs
    for (let offset = 0; offset < questions.length; offset++) {
      const candidateIndex = (startIndex + offset) % questions.length;
      const candidateId = String((questions[candidateIndex] as unknown as QuestionWithExplanation).id);

      if (!excludeIds.has(candidateId)) {
        chosenIndex = candidateIndex;
        break;
      }
    }

    // If all questions were excluded, return 404
    if (chosenIndex === -1) {
      return NextResponse.json(
        { error: 'No eligible questions available given exclusions.' },
        { status: 404 }
      );
    }

    const question = questions[chosenIndex] as unknown as QuestionWithExplanation;

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
    console.error('Current question API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 