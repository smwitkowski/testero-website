import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { serializeQuestion } from '@/lib/practice/serialize';

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
 */
function parseDifficulty(difficultyStr: string | null): number | undefined {
  if (!difficultyStr) {
    return undefined;
  }
  const difficulty = Number.parseInt(difficultyStr, 10);
  if (Number.isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new Error('Invalid difficulty (must be 1-5)');
  }
  return difficulty;
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
    // Parse excludeIds from query parameters (comma-separated list)
    const excludeIdsParam = request.nextUrl.searchParams.get("excludeIds");
    const excludeIds = new Set(
      (excludeIdsParam?.split(",") || [])
        .map((id) => id.trim())
        .filter(Boolean)
    );

    // Create server-side Supabase client and check authentication
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Auth check failed in current question API:', authError?.message);
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to access questions.',
        authError: authError?.message 
      }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const topic = searchParams.get('topic')?.trim() || undefined;
    const hasExplanationParam = searchParams.get('hasExplanation');
    const hasExplanation = hasExplanationParam?.toLowerCase() === 'false' ? false : true;
    
    // Validate difficulty parameter
    let difficulty: number | undefined;
    try {
      difficulty = parseDifficulty(searchParams.get('difficulty'));
    } catch (error) {
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Invalid difficulty (must be 1-5)' 
      }, { status: 400 });
    }

    // Build query with filters - always apply is_diagnostic_eligible=true
    let query = supabase
      .from('questions')
      .select(selectColumns(hasExplanation))
      .eq('is_diagnostic_eligible', true);

    // Apply optional filters with AND semantics
    if (topic) {
      query = query.eq('topic', topic);
    }
    if (difficulty !== undefined) {
      query = query.eq('difficulty', difficulty);
    }

    // Execute query with limit
    const { data: questions, error: questionError } = await query.limit(QUESTION_SAMPLE_SIZE);

    if (questionError || !questions || questions.length === 0) {
      console.info('No eligible questions with explanations for user', { userId: user.id, sampleLimit: QUESTION_SAMPLE_SIZE });
      return NextResponse.json({ error: 'No eligible questions with explanations.' }, { status: 404 });
    }

    // Use deterministic rotation to select a question, but skip excluded IDs
    const startIndex = calculateQuestionIndex(user.id, questions.length);
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

    // Fetch options for the question
    const { data: options, error: optionsError } = await supabase
      .from('options')
      .select('id, label, text')
      .eq('question_id', question.id);

    if (optionsError) {
      return NextResponse.json({ error: 'Error fetching options.' }, { status: 500 });
    }

    // Shape the response
    return NextResponse.json(serializeQuestion(question, options || []));
  } catch (error) {
    console.error('Current question API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 