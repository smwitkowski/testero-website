import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
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
    
    // Get all available questions
    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .limit(50); // Get a good sample size

    if (questionError || !questions || questions.length === 0) {
      return NextResponse.json({ error: 'No questions available in the database.' }, { status: 404 });
    }

    // For now, use a simple rotation based on user ID and current time
    // This ensures different users get different questions and the same user gets variety over time
    const userId = user.id;
    const currentHour = new Date().getHours();
    const userIdHash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const questionIndex = (userIdHash + currentHour + Math.floor(Date.now() / (1000 * 60 * 10))) % questions.length;
    
    const question = questions[questionIndex];

    // Fetch options for the question
    const { data: options, error: optionsError } = await supabase
      .from('options')
      .select('id, label, text')
      .eq('question_id', question.id);

    if (optionsError) {
      return NextResponse.json({ error: 'Error fetching options.' }, { status: 500 });
    }

    // Shape the response
    return NextResponse.json({
      id: question.id,
      question_text: question.stem,
      options: options || [],
    });
  } catch (error) {
    console.error('Current question API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 