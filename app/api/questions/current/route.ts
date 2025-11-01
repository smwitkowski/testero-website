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

    // For MVP, we'll implement a simple question rotation without persistence
    // TODO: Implement question tracking when user_question_progress table is properly set up
    
    // Get questions that have explanations (inner join filter)
    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('id, stem, explanations!inner(id)')
      .limit(QUESTION_SAMPLE_SIZE);

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
      const candidateId = String((questions[candidateIndex] as QuestionWithExplanation).id);
      
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

    const question = questions[chosenIndex] as QuestionWithExplanation;

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