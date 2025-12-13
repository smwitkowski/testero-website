/**
 * Domain-Targeted Practice Question Selection
 * 
 * Selects canonical PMLE questions for practice sessions based on specific domain codes
 * with even distribution across requested domains.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PracticeQuestionWithAnswers {
  id: string;
  stem: string;
  domain_id: string;
  domain_code: string;
  domain_name: string;
  answers: Array<{
    choice_label: string;
    choice_text: string;
    is_correct: boolean;
  }>;
}

export interface DomainSelectionResult {
  domainCode: string;
  requestedCount: number;
  availableCount: number;
  selectedCount: number;
}

export interface PracticeSelectionResult {
  questions: PracticeQuestionWithAnswers[];
  domainDistribution: DomainSelectionResult[];
  totalRequested: number;
  totalSelected: number;
}

// Minimum pool threshold per domain - log warning if below this
const MIN_POOL_THRESHOLD = 5;

/**
 * Select practice questions for specified domains with even distribution
 * 
 * @param supabase - Supabase client instance
 * @param examKey - Exam identifier (currently only 'pmle' supported)
 * @param domainCodes - Array of domain codes to select questions from
 * @param questionCount - Total number of questions to select
 * @returns Selected questions with domain distribution info
 */
export async function selectPracticeQuestionsByDomains(
  supabase: SupabaseClient,
  examKey: string,
  domainCodes: string[],
  questionCount: number
): Promise<PracticeSelectionResult> {
  if (domainCodes.length === 0) {
    throw new Error('At least one domain code must be provided');
  }

  if (questionCount <= 0) {
    throw new Error('Question count must be greater than 0');
  }

  // Currently only PMLE is supported
  if (examKey !== 'pmle') {
    throw new Error(`Unsupported exam key: ${examKey}. Only 'pmle' is currently supported.`);
  }

  // Step 0: Fetch domain IDs from domain codes (required because Supabase doesn't support
  // filtering on joined table fields directly)
  const { data: domainMetadata, error: domainMetadataError } = await supabase
    .from('exam_domains')
    .select('id, code, name')
    .in('code', domainCodes);

  if (domainMetadataError) {
    throw new Error(`Failed to fetch domain metadata: ${domainMetadataError.message}`);
  }

  if (!domainMetadata || domainMetadata.length === 0) {
    // Log warning but don't throw - allow function to return empty result
    console.warn(`No domains found for codes: ${domainCodes.join(', ')}`);
    return {
      questions: [],
      domainDistribution: domainCodes.map(code => ({
        domainCode: code,
        requestedCount: 0,
        availableCount: 0,
        selectedCount: 0,
      })),
      totalRequested: questionCount,
      totalSelected: 0,
    };
  }

  // Build domain code to ID/name mappings
  const domainCodeToId = new Map<string, string>();
  const domainCodeToName = new Map<string, string>();
  const domainIds: string[] = [];

  for (const domain of domainMetadata) {
    domainCodeToId.set(domain.code, domain.id);
    domainCodeToName.set(domain.code, domain.name);
    domainIds.push(domain.id);
  }

  // Validate all requested domains were found
  for (const domainCode of domainCodes) {
    if (!domainCodeToId.has(domainCode)) {
      console.warn(`Domain ${domainCode} not found in exam_domains table`);
    }
  }

  // Step 1: Get domain availability counts (only questions with explanations)
  // Filter by domain_id instead of joined table field
  const { data: domainCounts, error: countError } = await supabase
    .from('questions')
    .select(`
      domain_id,
      exam_domains!inner(code, name),
      explanations!inner(id)
    `)
    .eq('exam', 'GCP_PM_ML_ENG')
    .eq('status', 'ACTIVE')
    .eq('review_status', 'GOOD')
    .in('domain_id', domainIds);

  if (countError) {
    throw new Error(`Failed to fetch domain counts: ${countError.message}`);
  }

  // Build availability map (domain metadata already fetched above)
  const domainAvailability = new Map<string, number>();

  interface DomainCountRow {
    domain_id: string;
    exam_domains: {
      code: string;
      name: string;
    };
  }

  (domainCounts as unknown as DomainCountRow[] | null)?.forEach((q) => {
    const domain = q.exam_domains;
    const code = domain.code;
    domainAvailability.set(code, (domainAvailability.get(code) || 0) + 1);
  });

  // Validate all requested domains exist
  for (const domainCode of domainCodes) {
    if (!domainAvailability.has(domainCode)) {
      console.warn(`Domain ${domainCode} has no available questions with explanations`);
    }
  }

  // Step 2: Calculate even distribution across domains
  const domainTargets = calculateEvenDistribution(questionCount, domainCodes, domainAvailability);

  // Step 3: Select questions from each domain
  const selectedQuestions: PracticeQuestionWithAnswers[] = [];
  const domainDistribution: DomainSelectionResult[] = [];

  for (const domainCode of domainCodes) {
    const targetCount = domainTargets.get(domainCode) || 0;
    const availableCount = domainAvailability.get(domainCode) || 0;

    // Log warning if pool is below threshold
    if (availableCount > 0 && availableCount < MIN_POOL_THRESHOLD) {
      console.warn(
        `[CONTENT] Domain ${domainCode} has low ACTIVE+GOOD question pool: ${availableCount} questions available`
      );
    }

    if (targetCount === 0 || availableCount === 0) {
      domainDistribution.push({
        domainCode,
        requestedCount: targetCount,
        availableCount,
        selectedCount: 0,
      });
      continue;
    }

    const domainId = domainCodeToId.get(domainCode);
    if (!domainId) {
      console.warn(`Domain ID not found for code: ${domainCode}`);
      domainDistribution.push({
        domainCode,
        requestedCount: targetCount,
        availableCount,
        selectedCount: 0,
      });
      continue;
    }

    // Fetch questions for this domain with answers and explanations
    const { data: domainQuestions, error: fetchError } = await supabase
      .from('questions')
      .select(`
        id,
        stem,
        answers(choice_label, choice_text, is_correct),
        explanations!inner(id)
      `)
      .eq('exam', 'GCP_PM_ML_ENG')
      .eq('status', 'ACTIVE')
      .eq('review_status', 'GOOD')
      .eq('domain_id', domainId);
    // NOTE:
    // Avoid small `.limit()` sampling without DB-side random ordering.
    // Otherwise we repeatedly pull the same top-N rows and users see the same
    // few questions across sessions ("recycling").

    if (fetchError) {
      console.error(`Error fetching questions for domain ${domainCode}:`, fetchError);
      domainDistribution.push({
        domainCode,
        requestedCount: targetCount,
        availableCount,
        selectedCount: 0,
      });
      continue;
    }

    if (!domainQuestions || domainQuestions.length === 0) {
      console.warn(`No questions available for domain: ${domainCode}`);
      domainDistribution.push({
        domainCode,
        requestedCount: targetCount,
        availableCount,
        selectedCount: 0,
      });
      continue;
    }

    // Randomize and select target count
    const shuffled = [...domainQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(targetCount, shuffled.length));

    interface DomainQuestionRow {
      id: string;
      stem: string;
      answers: Array<{
        choice_label: string;
        choice_text: string;
        is_correct: boolean;
      }> | null;
      explanations: Array<{ id: string }>;
    }

    // Transform to PracticeQuestionWithAnswers format
    const transformed = (selected as DomainQuestionRow[]).map((q) => ({
      id: q.id,
      stem: q.stem,
      domain_id: domainId,
      domain_code: domainCode,
      domain_name: domainCodeToName.get(domainCode) || domainCode,
      answers: (q.answers || []).map((a) => ({
        choice_label: a.choice_label,
        choice_text: a.choice_text,
        is_correct: a.is_correct,
      })),
    }));

    selectedQuestions.push(...transformed);

    domainDistribution.push({
      domainCode,
      requestedCount: targetCount,
      availableCount,
      selectedCount: transformed.length,
    });
  }

  // Step 4: Log warning if insufficient questions
  const totalSelected = selectedQuestions.length;
  if (totalSelected < questionCount) {
    const totalAvailable = Array.from(domainAvailability.values()).reduce((a, b) => a + b, 0);
    console.warn(
      `Practice session: requested ${questionCount} questions, selected ${totalSelected}, ` +
      `total available ${totalAvailable} across requested domains.`
    );
  }

  // Step 5: Final shuffle to randomize domain order
  const finalShuffled = selectedQuestions.sort(() => Math.random() - 0.5);

  return {
    questions: finalShuffled,
    domainDistribution,
    totalRequested: questionCount,
    totalSelected: finalShuffled.length,
  };
}

/**
 * Calculate even distribution of questions across domains
 * 
 * Distributes questions evenly across requested domains, with remainder
 * distributed round-robin. If a domain has insufficient questions, reduces
 * its allocation and redistributes to other domains.
 * 
 * @param totalQuestions - Total number of questions to distribute
 * @param domainCodes - Array of domain codes to distribute across
 * @param domainAvailability - Map of domain code to available question count
 * @returns Map of domain code to target question count
 */
function calculateEvenDistribution(
  totalQuestions: number,
  domainCodes: string[],
  domainAvailability: Map<string, number>
): Map<string, number> {
  const targets = new Map<string, number>();
  
  if (domainCodes.length === 0) {
    return targets;
  }

  // Calculate base allocation per domain
  const basePerDomain = Math.floor(totalQuestions / domainCodes.length);
  const remainder = totalQuestions % domainCodes.length;

  // Initial allocation: base amount to each domain, capped by availability
  for (const domainCode of domainCodes) {
    const available = domainAvailability.get(domainCode) || 0;
    const initialTarget = Math.min(basePerDomain, available);
    targets.set(domainCode, initialTarget);
  }

  // Distribute remainder round-robin, respecting availability
  let remainingSlots = remainder;
  let domainIndex = 0;
  
  while (remainingSlots > 0 && domainIndex < domainCodes.length * 2) {
    const domainCode = domainCodes[domainIndex % domainCodes.length];
    const currentTarget = targets.get(domainCode) || 0;
    const available = domainAvailability.get(domainCode) || 0;
    
    if (currentTarget < available) {
      targets.set(domainCode, currentTarget + 1);
      remainingSlots--;
    }
    
    domainIndex++;
  }

  // If we still have remaining slots, redistribute from domains that couldn't fulfill their allocation
  if (remainingSlots > 0) {
    // Find domains that have spare capacity
    const domainsWithCapacity = domainCodes
      .map((code) => ({
        code,
        currentTarget: targets.get(code) || 0,
        available: domainAvailability.get(code) || 0,
        capacity: (domainAvailability.get(code) || 0) - (targets.get(code) || 0),
      }))
      .filter((d) => d.capacity > 0)
      .sort((a, b) => b.capacity - a.capacity); // Sort by capacity descending

    // Distribute remaining slots to domains with most capacity
    for (let i = 0; i < remainingSlots && i < domainsWithCapacity.length; i++) {
      const { code, currentTarget } = domainsWithCapacity[i];
      targets.set(code, currentTarget + 1);
    }
  }

  return targets;
}

