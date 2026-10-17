/**
 * PMLE Question Selection Logic
 * 
 * This module provides domain-weighted question selection for PMLE diagnostics
 * using the canonical questions schema and PMLE blueprint weights.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PMLE_BLUEPRINT, PMLE_BLUEPRINT_MAP } from '@/lib/constants/pmle-blueprint';
import { shuffleArray } from '@/lib/questions/answer-order';

export interface CanonicalAnswer {
  choice_label: string;
  choice_text: string;
  is_correct: boolean;
}

/** A selectable question must have usable options and exactly one answer key. */
export function hasValidAnswers(answers: unknown): answers is CanonicalAnswer[] {
  if (!Array.isArray(answers) || answers.length < 2 || answers.length > 26) return false;
  const labels = new Set<string>();
  let correctCount = 0;
  for (const answer of answers) {
    if (
      !answer ||
      typeof answer.choice_label !== 'string' || answer.choice_label.trim() === '' ||
      typeof answer.choice_text !== 'string' || answer.choice_text.trim() === '' ||
      typeof answer.is_correct !== 'boolean' ||
      labels.has(answer.choice_label)
    ) return false;
    labels.add(answer.choice_label);
    if (answer.is_correct) correctCount++;
  }
  return correctCount === 1;
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
 * Questions created from this date come from the current doc-grounded pipeline.
 * The 2026-10-14 bank export splits exactly here (100 new, 111 legacy). generation_run_id
 * exists in the schema but its population on legacy rows is unverified, so the date is the marker.
 */
export const DIAGNOSTIC_NEW_SINCE = '2026-10-04T00:00:00Z';

export interface SelectionPreferences {
  /** Prefer questions created at or after this ISO time. */
  newSince?: string;
  /** Prefer questions this owner has not seen in earlier diagnostics. */
  seenQuestionIds?: ReadonlySet<string>;
}

/**
 * Random pick that prefers, in order: new+unseen, new+seen, legacy+unseen, legacy+seen.
 * A thin preferred pool therefore falls back to the full pool for that domain.
 */
export function pickPreferred<T extends { id: string; created_at?: string | null }>(pool: T[], count: number, preferences: SelectionPreferences = {}): T[] {
  const started = performance.now();
  const since = preferences.newSince ? Date.parse(preferences.newSince) : NaN;
  const tier = (question: T) =>
    (Number.isFinite(since) && !(question.created_at && Date.parse(question.created_at) >= since) ? 2 : 0)
    + (preferences.seenQuestionIds?.has(question.id) ? 1 : 0);
  // Array.prototype.sort is stable, so each tier keeps its shuffled order.
  const selected = shuffleArray(pool).sort((a, b) => tier(a) - tier(b)).slice(0, count);
  if (process.env.NODE_ENV === 'development') console.info(`[selection-timing] pickPreferred ${Math.round(performance.now() - started)}ms`);
  return selected;
}

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
  if (!Number.isInteger(totalQuestions) || totalQuestions < 0) {
    throw new Error('Question count must be a non-negative integer');
  }
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
      // Repeat capacity redistribution until full or no domain has room.
      // One increment per domain is not enough when only one domain has stock.
      while (totalAllocated < totalQuestions) {
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
  
        if (sortedByAvailability.length === 0) break;
        for (const { domainCode } of sortedByAvailability) {
          if (totalAllocated >= totalQuestions) break;
          const currentTarget = targets.get(domainCode) || 0;
          targets.set(domainCode, currentTarget + 1);
          totalAllocated++;
        }
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
  totalQuestions: number,
  preferences: SelectionPreferences = {}
): Promise<SelectionResult> {
  // Load each eligible question once. Availability and sampling use the same inventory.
  const { data, error } = await supabase.from('questions')
    .select('id,stem,domain_id,difficulty,created_at,exam_domains!inner(code,name),answers(choice_label,choice_text,is_correct)')
    .eq('exam', 'GCP_PM_ML_ENG').eq('status', 'ACTIVE').eq('review_status', 'GOOD');
  if (error) throw new Error(`Failed to fetch domain counts: ${error.message}`);
  type Row = { id: string; stem: string; domain_id: string; difficulty: string | null; created_at: string | null;
    exam_domains: { code: string; name: string }; answers: CanonicalAnswer[] };
  const pools = new Map<string, Row[]>();
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!hasValidAnswers(row.answers)) continue;
    const pool = pools.get(row.exam_domains.code) ?? [];
    pool.push(row);
    pools.set(row.exam_domains.code, pool);
  }
  const domainAvailability = new Map([...pools].map(([code, pool]) => [code, pool.length]));
  const domainTargets = calculateDomainTargets(totalQuestions, domainAvailability);
  const selectedQuestions: CanonicalQuestionWithAnswers[] = [];
  const domainDistribution: DomainSelectionTarget[] = [];
  for (const [domainCode, targetCount] of domainTargets) {
    const pool = pools.get(domainCode) ?? [];
    if (pool.length > 0 && pool.length < MIN_POOL_THRESHOLD)
      console.warn(`[CONTENT] Domain ${domainCode} has low ACTIVE+GOOD question pool: ${pool.length} questions available`);
    const selected = pickPreferred(pool, targetCount, preferences);
    selectedQuestions.push(...selected.map(row => ({ id: row.id, stem: row.stem, domain_id: row.domain_id,
      domain_code: domainCode, domain_name: row.exam_domains.name, difficulty: row.difficulty, answers: row.answers })));
    domainDistribution.push({ domainCode, targetCount, availableCount: pool.length, selectedCount: selected.length });
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
  const finalShuffled = shuffleArray(selectedQuestions).slice(0, totalQuestions);

  // Log distribution in development
  if (process.env.NODE_ENV !== 'production') {
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

