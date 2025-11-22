/**
 * Test script to verify explanations are now being fetched for PMLE sessions
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSummaryExplanations() {
  // Get a completed PMLE session
  const { data: session } = await supabase
    .from('diagnostics_sessions')
    .select('id, exam_type, completed_at')
    .eq('exam_type', 'Google Professional Machine Learning Engineer')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    console.log('❌ No completed PMLE sessions found');
    return;
  }

  console.log(`\n📋 Testing session: ${session.id}`);
  console.log(`   Completed: ${session.completed_at}`);

  // Fetch questions with null original_question_id
  const { data: questions } = await supabase
    .from('diagnostic_questions')
    .select('id, stem, domain_id, domain_code, original_question_id')
    .eq('session_id', session.id)
    .is('original_question_id', null)
    .limit(5);

  if (!questions || questions.length === 0) {
    console.log('❌ No questions with null original_question_id found');
    return;
  }

  console.log(`\n📊 Found ${questions.length} questions with null original_question_id`);

  // Test the workaround: match by domain_id + stem
  const domainIds = Array.from(new Set(questions.map((q) => q.domain_id).filter(Boolean))) as string[];

  console.log(`\n🔍 Fetching canonical questions for ${domainIds.length} domains...`);

  const { data: canonicalQuestions } = await supabase
    .from('questions')
    .select('id, stem, domain_id')
    .in('domain_id', domainIds)
    .eq('exam', 'GCP_PM_ML_ENG')
    .eq('status', 'ACTIVE');

  if (!canonicalQuestions || canonicalQuestions.length === 0) {
    console.log('❌ No canonical questions found');
    return;
  }

  console.log(`   ✅ Found ${canonicalQuestions.length} canonical questions`);

  const canonicalQuestionIds = canonicalQuestions.map((q) => q.id);
  const { data: explanations } = await supabase
    .from('explanations')
    .select('question_id, explanation_text')
    .in('question_id', canonicalQuestionIds);

  console.log(`   ✅ Found ${explanations?.length ?? 0} explanations`);

  // Build the matching map
  const canonicalByDomainAndStem = new Map<string, string>();

  canonicalQuestions.forEach((cq) => {
    if (cq.domain_id && cq.stem) {
      const key = `${cq.domain_id}:${cq.stem.trim().toLowerCase()}`;
      const explanation = explanations?.find((e) => e.question_id === cq.id);
      if (explanation) {
        canonicalByDomainAndStem.set(key, explanation.explanation_text);
      }
    }
  });

  console.log(`\n🔗 Matching diagnostic questions to explanations...`);

  let matchedCount = 0;
  questions.forEach((dq, idx) => {
    if (dq.domain_id && dq.stem) {
      const normalizedStem = dq.stem.trim().toLowerCase();
      const key = `${dq.domain_id}:${normalizedStem}`;
      const explanation = canonicalByDomainAndStem.get(key);

      if (explanation) {
        matchedCount++;
        console.log(`\n   ✅ Question ${idx + 1}: MATCHED`);
        console.log(`      Stem: ${dq.stem.substring(0, 60)}...`);
        console.log(`      Domain: ${dq.domain_code}`);
        console.log(`      Explanation: ${explanation.substring(0, 80)}...`);
      } else {
        console.log(`\n   ❌ Question ${idx + 1}: NO MATCH`);
        console.log(`      Stem: ${dq.stem.substring(0, 60)}...`);
        console.log(`      Domain: ${dq.domain_code}`);
      }
    }
  });

  console.log(`\n📈 Summary:`);
  console.log(`   Total questions tested: ${questions.length}`);
  console.log(`   Matched explanations: ${matchedCount}`);
  console.log(`   Match rate: ${Math.round((matchedCount / questions.length) * 100)}%`);

  if (matchedCount > 0) {
    console.log(`\n✅ SUCCESS: Workaround is working! Explanations can be matched.`);
  } else {
    console.log(`\n⚠️  No matches found. This could mean:`);
    console.log(`   - Stem text doesn't match exactly (whitespace/formatting differences)`);
    console.log(`   - Questions were modified after snapshot`);
    console.log(`   - Domain mapping issue`);
  }
}

testSummaryExplanations().catch(console.error);

