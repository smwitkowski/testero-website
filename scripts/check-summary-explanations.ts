/**
 * Quick diagnostic script to check why explanations aren't showing in summary
 * 
 * Usage: npx tsx scripts/check-summary-explanations.ts [sessionId]
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSummaryExplanations(sessionId?: string) {

  // Get a completed session if none provided
  if (!sessionId) {
    const { data: sessions, error } = await supabase
      .from('diagnostics_sessions')
      .select('id, exam_type, completed_at, started_at')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1);

    if (error || !sessions || sessions.length === 0) {
      console.error('❌ No completed diagnostic sessions found');
      console.error('Error:', error);
      process.exit(1);
    }

    sessionId = sessions[0].id;
    console.log(`📋 Using most recent completed session: ${sessionId}`);
    console.log(`   Exam: ${sessions[0].exam_type}`);
    console.log(`   Completed: ${sessions[0].completed_at}`);
  }

  // Fetch diagnostic questions for this session
  const { data: questions, error: questionsError } = await supabase
    .from('diagnostic_questions')
    .select('id, stem, original_question_id, domain_code, domain_id')
    .eq('session_id', sessionId);

  if (questionsError) {
    console.error('❌ Error fetching questions:', questionsError);
    process.exit(1);
  }

  if (!questions || questions.length === 0) {
    console.error('❌ No questions found for this session');
    process.exit(1);
  }

  console.log(`\n📊 Found ${questions.length} questions in session ${sessionId}`);
  console.log('\n🔍 Checking original_question_id values:');

  const originalQuestionIds = questions
    .map((q) => q.original_question_id)
    .filter((id): id is string | number => id !== null && id !== undefined);

  const nullCount = questions.length - originalQuestionIds.length;
  const uuidCount = originalQuestionIds.filter((id) => typeof id === 'string' && id.includes('-')).length;
  const numericCount = originalQuestionIds.filter((id) => typeof id === 'number' || (typeof id === 'string' && !id.includes('-'))).length;

  console.log(`   • null: ${nullCount} questions`);
  console.log(`   • UUID: ${uuidCount} questions`);
  console.log(`   • Numeric: ${numericCount} questions`);

  // Sample a few questions
  console.log('\n📝 Sample questions:');
  questions.slice(0, 3).forEach((q, idx) => {
    console.log(`\n   Question ${idx + 1}:`);
    console.log(`   • ID: ${q.id}`);
    console.log(`   • original_question_id: ${q.original_question_id ?? 'NULL'}`);
    console.log(`   • domain_code: ${q.domain_code ?? 'NULL'}`);
    console.log(`   • Stem: ${q.stem.substring(0, 80)}...`);
  });

  // Check if explanations exist for the original_question_ids
  if (originalQuestionIds.length > 0) {
    const questionIdStrings = originalQuestionIds.map((id) => String(id));

    console.log(`\n🔎 Checking explanations table for ${questionIdStrings.length} question IDs...`);

    const { data: explanations, error: explanationsError } = await supabase
      .from('explanations')
      .select('question_id, explanation_text')
      .in('question_id', questionIdStrings);

    if (explanationsError) {
      console.error('❌ Error fetching explanations:', explanationsError);
    } else {
      console.log(`   ✅ Found ${explanations?.length ?? 0} explanations`);
      if (explanations && explanations.length > 0) {
        console.log('\n   Sample explanations:');
        explanations.slice(0, 2).forEach((e, idx) => {
          console.log(`   • question_id: ${e.question_id}`);
          console.log(`     Text: ${e.explanation_text.substring(0, 100)}...`);
        });
      } else {
        console.log('   ⚠️  No explanations found for these question IDs');
      }
    }
  } else {
    console.log('\n⚠️  No original_question_id values found - explanations cannot be fetched!');
    console.log('   This is the root cause: PMLE canonical questions use UUID IDs,');
    console.log('   but diagnostic_questions.original_question_id is bigint, so it\'s set to null.');
  }

  // Check canonical questions table to see if we can find explanations by domain_code
  if (questions.some((q) => q.domain_code)) {
    console.log('\n🔍 Checking if we can find explanations via domain_code...');
    const domainCodes = Array.from(new Set(questions.map((q) => q.domain_code).filter(Boolean)));
    console.log(`   Found ${domainCodes.length} unique domain codes: ${domainCodes.join(', ')}`);

    // Try to find canonical questions with these domain codes that have explanations
    const { data: canonicalQuestions, error: canonicalError } = await supabase
      .from('questions')
      .select('id, stem, domain_id')
      .in('domain_id', questions.map((q) => q.domain_id).filter(Boolean) as string[])
      .limit(5);

    if (canonicalError) {
      console.log('   ⚠️  Could not query canonical questions:', canonicalError.message);
    } else {
      console.log(`   Found ${canonicalQuestions?.length ?? 0} canonical questions with matching domain_ids`);
      if (canonicalQuestions && canonicalQuestions.length > 0) {
        const canonicalIds = canonicalQuestions.map((q) => q.id);
        const { data: canonicalExplanations } = await supabase
          .from('explanations')
          .select('question_id')
          .in('question_id', canonicalIds);

        console.log(`   ✅ ${canonicalExplanations?.length ?? 0} of these have explanations`);
      }
    }
  }

  console.log('\n✅ Diagnostic complete!');
}

// Run the check
const sessionId = process.argv[2];
checkSummaryExplanations(sessionId).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

