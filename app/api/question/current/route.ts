import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  // Fetch the first available question (no is_active filter)
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (questionError || !question) {
    return NextResponse.json({ error: 'No question found or database error.' }, { status: 404 });
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
  });
} 