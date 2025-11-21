/**
 * Backfill script for PMLE question domain mappings
 * 
 * This script maps legacy topic-based domain codes to canonical blueprint domains
 * and updates questions.domain_id for all ACTIVE GCP_PM_ML_ENG questions.
 * 
 * Usage:
 *   # Dry run (preview changes without updating)
 *   npx tsx scripts/backfill-pmle-domains.ts --dry-run
 * 
 *   # Apply changes
 *   npx tsx scripts/backfill-pmle-domains.ts
 * 
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { PMLE_BLUEPRINT } from '../lib/constants/pmle-blueprint';
import { LEGACY_TO_BLUEPRINT_MAP } from '../lib/diagnostic/pmle-domain-mapping';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface QuestionWithDomain {
  id: string;
  stem: string;
  domain_id: string;
  current_domain_code: string;
  current_domain_name: string;
}

interface UpdatePlan {
  question: QuestionWithDomain;
  targetDomainCode: string;
  targetDomainId: string;
  targetDomainName: string;
}

async function ensureBlueprintDomainsExist(): Promise<Map<string, string>> {
  console.log('📋 Ensuring blueprint domains exist...\n');
  
  const domainCodeToId = new Map<string, string>();
  
  // Define the 6 canonical blueprint domains (regardless of what's in PMLE_BLUEPRINT)
  const canonicalBlueprintDomains = [
    { domainCode: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS', displayName: 'Architecting Low-Code ML Solutions' },
    { domainCode: 'COLLABORATING_TO_MANAGE_DATA_AND_MODELS', displayName: 'Collaborating to Manage Data & Models' },
    { domainCode: 'SCALING_PROTOTYPES_INTO_ML_MODELS', displayName: 'Scaling Prototypes into ML Models' },
    { domainCode: 'SERVING_AND_SCALING_MODELS', displayName: 'Serving & Scaling Models' },
    { domainCode: 'AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES', displayName: 'Automating & Orchestrating ML Pipelines' },
    { domainCode: 'MONITORING_ML_SOLUTIONS', displayName: 'Monitoring ML Solutions' },
  ];
  
  for (const blueprintDomain of canonicalBlueprintDomains) {
    // Check if domain exists
    const { data: existing, error: fetchError } = await supabase
      .from('exam_domains')
      .select('id, code, name')
      .eq('code', blueprintDomain.domainCode)
      .maybeSingle(); // Use maybeSingle() instead of single() to return null instead of error when not found
    
    if (fetchError) {
      console.error(`❌ Error checking domain ${blueprintDomain.domainCode}:`, fetchError);
      throw fetchError;
    }
    
    if (existing) {
      console.log(`  ✓ Domain exists: ${blueprintDomain.domainCode}`);
      domainCodeToId.set(blueprintDomain.domainCode, existing.id);
    } else {
      // Create domain
      const { data: created, error: createError } = await supabase
        .from('exam_domains')
        .insert({
          code: blueprintDomain.domainCode,
          name: blueprintDomain.displayName,
        })
        .select('id')
        .single();
      
      if (createError) {
        console.error(`❌ Error creating domain ${blueprintDomain.domainCode}:`, createError);
        throw createError;
      }
      
      if (!created) {
        console.error(`❌ Failed to create domain ${blueprintDomain.domainCode}: No data returned`);
        throw new Error(`Failed to create domain ${blueprintDomain.domainCode}`);
      }
      
      console.log(`  ✓ Created domain: ${blueprintDomain.domainCode}`);
      domainCodeToId.set(blueprintDomain.domainCode, created.id);
    }
  }
  
  console.log('');
  return domainCodeToId;
}

async function fetchActivePmleQuestions(): Promise<QuestionWithDomain[]> {
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      stem,
      domain_id,
      exam_domains!inner(code, name)
    `)
    .eq('exam', 'GCP_PM_ML_ENG')
    .eq('status', 'ACTIVE');
  
  if (error) {
    console.error('❌ Error fetching questions:', error);
    throw error;
  }
  
  return (data || []).map((q: any) => ({
    id: q.id,
    stem: q.stem,
    domain_id: q.domain_id,
    current_domain_code: q.exam_domains.code,
    current_domain_name: q.exam_domains.name,
  }));
}

function planUpdates(
  questions: QuestionWithDomain[],
  domainCodeToId: Map<string, string>
): UpdatePlan[] {
  const updates: UpdatePlan[] = [];
  
  for (const question of questions) {
    const targetDomainCode = LEGACY_TO_BLUEPRINT_MAP[question.current_domain_code];
    
    if (!targetDomainCode) {
      // Question cannot be mapped - will be logged but not updated
      continue;
    }
    
    const targetDomainId = domainCodeToId.get(targetDomainCode);
    if (!targetDomainId) {
      console.error(`❌ Target domain ID not found for code: ${targetDomainCode}`);
      continue;
    }
    
    // Only plan update if domain_id needs to change
    if (question.domain_id !== targetDomainId) {
      const blueprintDomain = PMLE_BLUEPRINT.find((d) => d.domainCode === targetDomainCode);
      updates.push({
        question,
        targetDomainCode,
        targetDomainId,
        targetDomainName: blueprintDomain?.displayName || targetDomainCode,
      });
    }
  }
  
  return updates;
}

async function applyUpdates(updates: UpdatePlan[], dryRun: boolean): Promise<void> {
  if (updates.length === 0) {
    console.log('✅ No updates needed - all questions already mapped correctly!\n');
    return;
  }
  
  if (dryRun) {
    console.log(`🔍 DRY RUN: Would update ${updates.length} questions\n`);
    
    // Group by target domain
    const byDomain = new Map<string, UpdatePlan[]>();
    for (const update of updates) {
      if (!byDomain.has(update.targetDomainCode)) {
        byDomain.set(update.targetDomainCode, []);
      }
      byDomain.get(update.targetDomainCode)!.push(update);
    }
    
    for (const [domainCode, domainUpdates] of byDomain.entries()) {
      const domainName = domainUpdates[0].targetDomainName;
      console.log(`  ${domainCode} (${domainName}): ${domainUpdates.length} questions`);
    }
    
    console.log('\n📝 Sample updates (first 5):');
    updates.slice(0, 5).forEach((update) => {
      console.log(`  - ${update.question.id.substring(0, 8)}...`);
      console.log(`    From: ${update.question.current_domain_code}`);
      console.log(`    To:   ${update.targetDomainCode}\n`);
    });
    
    return;
  }
  
  console.log(`🔄 Applying ${updates.length} updates...\n`);
  
  // Update in batches of 50
  const batchSize = 50;
  let updated = 0;
  let errors = 0;
  
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    for (const update of batch) {
      const { error } = await supabase
        .from('questions')
        .update({ domain_id: update.targetDomainId })
        .eq('id', update.question.id);
      
      if (error) {
        console.error(`❌ Error updating question ${update.question.id}:`, error);
        errors++;
      } else {
        updated++;
      }
    }
    
    // Progress indicator
    if ((i + batchSize) % 50 === 0 || i + batchSize >= updates.length) {
      process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, updates.length)}/${updates.length}`);
    }
  }
  
  console.log('\n');
  console.log(`✅ Updated: ${updated}`);
  if (errors > 0) {
    console.log(`❌ Errors: ${errors}`);
  }
  console.log('');
}

async function backfillPmleDomains() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🚀 PMLE Domain Backfill Script');
  console.log('─'.repeat(80));
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be applied to database\n');
  }
  
  try {
    // Step 1: Ensure blueprint domains exist
    const domainCodeToId = await ensureBlueprintDomainsExist();
    
    // Step 2: Fetch all ACTIVE PMLE questions
    console.log('📥 Fetching ACTIVE PMLE questions...');
    const questions = await fetchActivePmleQuestions();
    console.log(`  Found ${questions.length} ACTIVE PMLE questions\n`);
    
    // Step 3: Plan updates
    console.log('📋 Planning updates...');
    const updates = planUpdates(questions, domainCodeToId);
    
    // Identify unmapped questions
    const mappedCodes = new Set(Object.keys(LEGACY_TO_BLUEPRINT_MAP));
    const unmappedQuestions = questions.filter(
      (q) => !mappedCodes.has(q.current_domain_code)
    );
    
    if (unmappedQuestions.length > 0) {
      console.warn(`⚠️  Found ${unmappedQuestions.length} questions with unmapped domain codes:`);
      const unmappedCodes = new Set(unmappedQuestions.map((q) => q.current_domain_code));
      unmappedCodes.forEach((code) => {
        const count = unmappedQuestions.filter((q) => q.current_domain_code === code).length;
        console.warn(`  - ${code}: ${count} questions`);
      });
      console.warn('  These questions will NOT be updated. Add mapping to LEGACY_TO_BLUEPRINT_MAP.\n');
    }
    
    const unchanged = questions.length - updates.length - unmappedQuestions.length;
    console.log(`  Updates needed: ${updates.length}`);
    console.log(`  Already correct: ${unchanged}`);
    console.log(`  Unmapped: ${unmappedQuestions.length}\n`);
    
    // Step 4: Apply updates
    await applyUpdates(updates, dryRun);
    
    // Step 5: Summary
    console.log('📊 Summary:');
    console.log('─'.repeat(80));
    console.log(`Total ACTIVE PMLE questions: ${questions.length}`);
    if (!dryRun && updates.length > 0) {
      // Count actual updates from applyUpdates result
      const updatedCount = updates.length; // applyUpdates logs this separately
      console.log(`Questions updated: ${updatedCount}`);
    } else {
      console.log(`Questions to update: ${updates.length}`);
    }
    console.log(`Questions unchanged: ${unchanged}`);
    console.log(`Questions unmapped: ${unmappedQuestions.length}`);
    
    if (!dryRun) {
      console.log('\n✅ Backfill complete!');
      console.log('💡 Run scripts/validate-pmle-domains.ts to verify results.');
    } else {
      console.log('\n💡 Run without --dry-run to apply changes.');
    }
    
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

backfillPmleDomains().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

