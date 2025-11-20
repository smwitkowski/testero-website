/**
 * Validation script for PMLE question domain mappings
 * 
 * This script verifies that all canonical PMLE questions have valid domain_id values
 * and checks domain distribution for capacity planning.
 * 
 * Usage:
 *   npx tsx scripts/validate-pmle-domains.ts
 * 
 * Or run the SQL queries directly in Supabase SQL editor:
 *   See docs/sql/pmle-domain-check.sql
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function validatePmleDomains() {
  console.log('🔍 Validating PMLE question domain mappings...\n');

  // Check 1: All ACTIVE PMLE questions have domain_id
  const { data: questionsWithoutDomain, error: error1 } = await supabase
    .from('questions')
    .select('id, stem, exam, status')
    .eq('exam', 'GCP_PM_ML_ENG')
    .eq('status', 'ACTIVE')
    .is('domain_id', null);

  if (error1) {
    console.error('❌ Error checking questions without domain:', error1);
    return;
  }

  if (questionsWithoutDomain && questionsWithoutDomain.length > 0) {
    console.error(`❌ Found ${questionsWithoutDomain.length} ACTIVE PMLE questions without domain_id:`);
    questionsWithoutDomain.forEach((q) => {
      console.error(`  - ${q.id}: ${q.stem.substring(0, 80)}...`);
    });
    console.error('\n⚠️  These questions need domain_id assignment before diagnostics can work.\n');
  } else {
    console.log('✅ All ACTIVE PMLE questions have domain_id assigned\n');
  }

  // Check 2: Domain distribution for capacity planning
  const { data: domainCounts, error: error2 } = await supabase
    .from('questions')
    .select(`
      domain_id,
      exam_domains!inner(code, name)
    `)
    .eq('exam', 'GCP_PM_ML_ENG')
    .eq('status', 'ACTIVE');

  if (error2) {
    console.error('❌ Error fetching domain counts:', error2);
    return;
  }

  // Group by domain
  const domainMap = new Map<string, { name: string; count: number }>();
  
  domainCounts?.forEach((q: any) => {
    const domain = q.exam_domains;
    const code = domain.code;
    const name = domain.name;
    
    if (!domainMap.has(code)) {
      domainMap.set(code, { name, count: 0 });
    }
    domainMap.get(code)!.count++;
  });

  console.log('📊 Domain distribution (ACTIVE questions):');
  console.log('─'.repeat(80));
  
  const sortedDomains = Array.from(domainMap.entries()).sort((a, b) => b[1].count - a[1].count);
  
  sortedDomains.forEach(([code, { name, count }]) => {
    const bar = '█'.repeat(Math.floor(count / 2));
    console.log(`${code.padEnd(50)} ${count.toString().padStart(3)} ${bar}`);
    console.log(`  ${name}`);
  });

  const totalQuestions = domainCounts?.length || 0;
  console.log('─'.repeat(80));
  console.log(`Total ACTIVE PMLE questions: ${totalQuestions}`);
  console.log(`Total domains: ${domainMap.size}\n`);

  // Check 3: Verify all domains in blueprint exist in database
  const { PMLE_BLUEPRINT } = await import('../lib/constants/pmle-blueprint');
  const { data: allDomains, error: error3 } = await supabase
    .from('exam_domains')
    .select('code');

  if (error3) {
    console.error('❌ Error fetching domains:', error3);
    return;
  }

  const dbDomainCodes = new Set(allDomains?.map((d) => d.code) || []);
  const blueprintCodes = new Set(PMLE_BLUEPRINT.map((d) => d.domainCode));

  const missingInDb = Array.from(blueprintCodes).filter((code) => !dbDomainCodes.has(code));
  const missingInBlueprint = Array.from(dbDomainCodes).filter((code) => !blueprintCodes.has(code));

  if (missingInDb.length > 0) {
    console.warn('⚠️  Domains in blueprint but not in database:');
    missingInDb.forEach((code) => console.warn(`  - ${code}`));
    console.log('');
  }

  if (missingInBlueprint.length > 0) {
    console.warn('⚠️  Domains in database but not in blueprint:');
    missingInBlueprint.forEach((code) => console.warn(`  - ${code}`));
    console.log('');
  }

  if (missingInDb.length === 0 && missingInBlueprint.length === 0) {
    console.log('✅ All blueprint domains exist in database\n');
  }

  console.log('✅ Validation complete!');
}

validatePmleDomains().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});

