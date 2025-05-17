import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  // Extract ID from the URL path
  const pathParts = request.nextUrl.pathname.split('/');
  const questionId = pathParts[pathParts.length - 1];

  if (!questionId) {
    return NextResponse.json({ error: 'Question ID is required.' }, { status: 400 });
  }

  // Fetch the question by ID
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();

  if (questionError || !question) {
    return NextResponse.json({ error: 'Question not found or database error.' }, { status: 404 });
  }

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
    // Potentially include other question details needed for the page, like explanation if available directly
    // explanation: question.explanation_text, // Assuming such a field exists
  });
}
