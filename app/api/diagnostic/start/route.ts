import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { examType, numQuestions } = body;

    if (!examType || !numQuestions) {
      return NextResponse.json({ error: 'Missing examType or numQuestions.' }, { status: 400 });
    }

    const supabaseServer = createServerSupabaseClient();

    // Get user ID from Supabase auth
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated.' }, { status: 401 });
    }

    // 1. Create a new diagnostic session
    const { data: session, error: sessionError } = await supabaseServer
      .from('diagnostics_sessions')
      .insert({ user_id: user.id, exam_type: examType })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Error creating diagnostic session:', sessionError);
      return NextResponse.json({ error: 'Failed to create diagnostic session.' }, { status: 500 });
    }

    const sessionId = session.id;
    const diagnosticQuestions = [];

    // 2. Generate or fetch questions (MVP: simple stub/placeholder)
    // In a real implementation, this would involve AI generation or fetching from a pool
    for (let i = 0; i < numQuestions; i++) {
      // Placeholder for AI-generated question
      const question = {
        stem: `This is a placeholder question ${i + 1} for ${examType}.`,
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
          { label: 'C', text: 'Option C' },
          { label: 'D', text: 'Option D' },
        ],
        correct_label: 'A', // Always 'A' for now
      };
      diagnosticQuestions.push(question);
    }

    // 3. Insert diagnostic questions into the database
    const questionsToInsert = diagnosticQuestions.map(q => ({
      session_id: sessionId,
      stem: q.stem,
      options: q.options,
      correct_label: q.correct_label,
    }));

    const { error: insertQuestionsError } = await supabaseServer
      .from('diagnostic_questions')
      .insert(questionsToInsert);

    if (insertQuestionsError) {
      console.error('Error inserting diagnostic questions:', insertQuestionsError);
      return NextResponse.json({ error: 'Failed to insert diagnostic questions.' }, { status: 500 });
    }

    // Return session ID and questions (without correct answers)
    const questionsForFrontend = diagnosticQuestions.map(q => ({
      stem: q.stem,
      options: q.options,
    }));

    return NextResponse.json({
      sessionId,
      questions: questionsForFrontend,
    });

  } catch (error) {
    console.error('Diagnostic start API error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
