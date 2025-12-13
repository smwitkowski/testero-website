/**
 * PMLE Question Selection Logic
 * 
 * This module provides domain-weighted question selection for PMLE diagnostics
 * using the canonical questions schema and PMLE blueprint weights.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PMLE_BLUEPRINT, PMLE_BLUEPRINT_MAP } from '@/lib/constants/pmle-blueprint';

export interface CanonicalAnswer {
  choice_label: string;
  choice_text: string;
  is_correct: boolean;
}

export interface CanonicalQuestionWithAnswers {
  id: string;
  stem: string;
  domain_id: string;
  domain_code: string;
  domain_name: string;
  difficulty: string | null;
  answers: CanonicalAnswer[];
}

export interface DomainSelectionTarget {
  domainCode: string;
  targetCount: number;
  availableCount: number;
  selectedCount: number;
}

export interface SelectionResult {
  questions: CanonicalQuestionWithAnswers[];
  domainDistribution: DomainSelectionTarget[];
}

// Minimum pool threshold per domain - log warning if below this
const MIN_POOL_THRESHOLD = 5;

/**
 * Calculate domain targets from blueprint weights
 * Uses largest remainder method for fair rounding
 * 
 * @internal Exported for testing
 */
export function calculateDomainTargets(
  totalQuestions: number,
  domainAvailability: Map<string, number>
): Map<string, number> {
  const targets = new Map<string, number>();
  const remainders: Array<{ domainCode: string; remainder: number }> = [];

  // Calculate raw targets and collect remainders
  let totalAllocated = 0;
  for (const config of PMLE_BLUEPRINT) {
    const rawTarget = config.weight * totalQuestions;
    const floorTarget = Math.floor(rawTarget);
    const remainder = rawTarget - floorTarget;

    const available = domainAvailability.get(config.domainCode) || 0;
    const cappedTarget = Math.min(floorTarget, available);

    targets.set(config.domainCode, cappedTarget);
    totalAllocated += cappedTarget;

    if (remainder > 0 && cappedTarget < available) {
      remainders.push({ domainCode: config.domainCode, remainder });
    }
  }

  // Distribute remainder using largest remainder method
  const remaining = totalQuestions - totalAllocated;
  if (remaining > 0) {
    remainders.sort((a, b) => b.remainder - a.remainder);

    for (let i = 0; i < remaining && i < remainders.length; i++) {
      const { domainCode } = remainders[i];
      const currentTarget = targets.get(domainCode) || 0;
      const available = domainAvailability.get(domainCode) || 0;

      if (currentTarget < available) {
        targets.set(domainCode, currentTarget + 1);
        totalAllocated++;
      }
    }

    // If still have remainder, distribute to domains with most availability
    if (totalAllocated < totalQuestions) {
      const stillRemaining = totalQuestions - totalAllocated;
      const sortedByAvailability = Array.from(domainAvailability.entries())
        .map(([code, available]) => ({
          domainCode: code,
          available,
          currentTarget: targets.get(code) || 0,
        }))
        .filter((d) => d.currentTarget < d.available)
        .sort((a, b) => {
          // Sort by available capacity (descending)
          const capacityA = a.available - a.currentTarget;
          const capacityB = b.available - b.currentTarget;
          if (capacityA !== capacityB) return capacityB - capacityA;
          // Then by weight (descending)
          const weightA = PMLE_BLUEPRINT_MAP[a.domainCode]?.weight || 0;
          const weightB = PMLE_BLUEPRINT_MAP[b.domainCode]?.weight || 0;
          return weightB - weightA;
        });

      for (let i = 0; i < stillRemaining && i < sortedByAvailability.length; i++) {
        const { domainCode } = sortedByAvailability[i];
        const currentTarget = targets.get(domainCode) || 0;
        targets.set(domainCode, currentTarget + 1);
      }
    }
  }

  return targets;
}

/**
 * Select PMLE questions using blueprint domain weights
 * 
 * @param supabase - Supabase client instance
 * @param totalQuestions - Total number of questions to select
 * @returns Selected questions with answers and domain info
 */
export async function selectPmleQuestionsByBlueprint(
  supabase: SupabaseClient,
  totalQuestions: number
): Promise<SelectionResult> {
  // Step 1: Get domain availability counts
  const { data: domainCounts, error: countError } = await supabase
    .from('questions')
    .select(`
      domain_id,
      exam_domains!inner(code, name)
    `)
    .eq('exam', 'GCP_PM_ML_ENG')
    .eq('status', 'ACTIVE')
    .eq('review_status', 'GOOD');

  if (countError) {
    throw new Error(`Failed to fetch domain counts: ${countError.message}`);
  }

  // Build availability map
  const domainAvailability = new Map<string, number>();
  const domainCodeToId = new Map<string, string>();
  const domainCodeToName = new Map<string, string>();

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
    domainCodeToId.set(code, q.domain_id);
    domainCodeToName.set(code, domain.name);
  });

  // Step 2: Calculate domain targets
  const domainTargets = calculateDomainTargets(totalQuestions, domainAvailability);

  // Step 3: Select questions from each domain
  const selectedQuestions: CanonicalQuestionWithAnswers[] = [];
  const domainDistribution: DomainSelectionTarget[] = [];

  for (const [domainCode, targetCount] of domainTargets.entries()) {
    const availableCount = domainAvailability.get(domainCode) || 0;
    
    // Log warning if pool is below threshold
    if (availableCount > 0 && availableCount < MIN_POOL_THRESHOLD) {
      console.warn(
        `[CONTENT] Domain ${domainCode} has low ACTIVE+GOOD question pool: ${availableCount} questions available`
      );
    }
    
    if (targetCount === 0) {
      domainDistribution.push({
        domainCode,
        targetCount: 0,
        availableCount,
        selectedCount: 0,
      });
      continue;
    }

    const domainId = domainCodeToId.get(domainCode);
    if (!domainId) {
      console.warn(`Domain ID not found for code: ${domainCode}`);
      continue;
    }

    // Fetch questions for this domain with answers
    const { data: domainQuestions, error: fetchError } = await supabase
      .from('questions')
      .select(`
        id,
        stem,
        difficulty,
        answers(choice_label, choice_text, is_correct)
      `)
      .eq('exam', 'GCP_PM_ML_ENG')
      .eq('status', 'ACTIVE')
      .eq('review_status', 'GOOD')
      .eq('domain_id', domainId);
    // NOTE:
    // We intentionally do NOT apply a small `.limit()` here.
    // PostgREST/Supabase results are typically stable in practice, so doing a small limit
    // without a true randomized DB order causes the app to repeatedly sample from the same
    // tiny subset of questions (which users experience as "only ~10 questions that recycle").
    //
    // Current PMLE pool size is small enough that fetching the full domain pool is acceptable,
    // and we randomize in-memory below before slicing to `targetCount`.

    if (fetchError) {
      console.error(`Error fetching questions for domain ${domainCode}:`, fetchError);
      continue;
    }

    if (!domainQuestions || domainQuestions.length === 0) {
      console.warn(`No questions available for domain: ${domainCode}`);
      domainDistribution.push({
        domainCode,
        targetCount,
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
      difficulty: string | null;
      answers: Array<{
        choice_label: string;
        choice_text: string;
        is_correct: boolean;
      }> | null;
    }

    // Transform to CanonicalQuestionWithAnswers format
    const transformed = (selected as DomainQuestionRow[]).map((q) => ({
      id: q.id,
      stem: q.stem,
      domain_id: domainId,
      domain_code: domainCode,
      domain_name: domainCodeToName.get(domainCode) || domainCode,
      difficulty: q.difficulty,
      answers: (q.answers || []).map((a) => ({
        choice_label: a.choice_label,
        choice_text: a.choice_text,
        is_correct: a.is_correct,
      })),
    }));

    selectedQuestions.push(...transformed);

    domainDistribution.push({
      domainCode,
      targetCount,
      availableCount,
      selectedCount: transformed.length,
    });
  }

  // Step 4: Validate we have enough questions
  if (selectedQuestions.length < totalQuestions) {
    const totalAvailable = Array.from(domainAvailability.values()).reduce((a, b) => a + b, 0);
    throw new Error(
      `Insufficient questions: requested ${totalQuestions}, selected ${selectedQuestions.length}, ` +
      `total available ${totalAvailable}. Content gaps detected.`
    );
  }

  // Step 5: Final shuffle to randomize domain order
  const finalShuffled = selectedQuestions.sort(() => Math.random() - 0.5).slice(0, totalQuestions);

  // Log distribution in development
  if (process.env.NODE_ENV !== 'production' || process.env.DIAGNOSTIC_BLUEPRINT_DEBUG === 'true') {
    console.log('📊 PMLE Diagnostic Domain Distribution:');
    domainDistribution.forEach((dist) => {
      const match = dist.targetCount === dist.selectedCount ? '✅' : '⚠️';
      console.log(
        `${match} ${dist.domainCode}: ${dist.selectedCount}/${dist.targetCount} ` +
        `(available: ${dist.availableCount})`
      );
    });
    console.log(`Total selected: ${finalShuffled.length}/${totalQuestions}`);
  }

  return {
    questions: finalShuffled,
    domainDistribution,
  };
}

