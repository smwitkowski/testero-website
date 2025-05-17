import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  // Fetch all question IDs
  const { data: questions, error: questionError } = await supabase
    .from('questions')
    .select('id')
    .order('id', { ascending: true });

  if (questionError || !questions) {
    return NextResponse.json({ error: 'No questions found or database error.' }, { status: 404 });
  }

  // Return only the IDs
  const questionIds = questions.map(q => q.id);

  return NextResponse.json({
    questionIds,
  });
}
