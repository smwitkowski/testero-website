/**
 * PMLE Blueprint Domain Weights Configuration
 *
 * This Week 2 stopgap configuration defines the domain weights for the Professional Machine Learning
 * Engineer (PMLE) exam. `calculateDomainTargets()` multiplies these weights by the requested question
 * count (`weight * N`), rounds them, and then balances remainders to ensure exactly `N` questions while
 * respecting per-domain availability.
 *
 * Usage:
 * - Each diagnostic domain target starts as roughly `weight * N`
 * - `calculateDomainTargets()` rounds, caps by availability, and redistributes remainders
 * - Domains with insufficient inventory contribute fewer questions; remaining slots are reassigned
 *
 * IMPORTANT: This is a temporary in-code blueprint for Week 2. A future iteration will replace it
 * with a DB-driven blueprint editor so non-developers can adjust weights without code changes.
 */

export interface PmleDomainConfig {
  /** Domain code matching exam_domains.code exactly */
  domainCode: string;
  /** Human-readable display name for the domain */
  displayName: string;
  /**
   * Weight (0–1) approximating this domain's official PMLE blueprint percentage.
   * Used by `calculateDomainTargets()` as a fraction of the requested question count.
   */
  weight: number;
}

/**
 * PMLE Blueprint Configuration
 * 
 * Weights should sum to approximately 1.0 (allowing for rounding).
 * These represent the approximate distribution of questions across domains in the PMLE exam.
 */
export const PMLE_BLUEPRINT: PmleDomainConfig[] = [
  {
    domainCode: "ARCHITECTING_LOW_CODE_ML_SOLUTIONS",
    displayName: "Architecting Low-Code ML Solutions",
    weight: 0.125, // 12–13%
  },
  {
    domainCode: "COLLABORATING_TO_MANAGE_DATA_AND_MODELS",
    displayName: "Collaborating to Manage Data & Models",
    weight: 0.155, // 14–16%
  },
  {
    domainCode: "SCALING_PROTOTYPES_INTO_ML_MODELS",
    displayName: "Scaling Prototypes into ML Models",
    weight: 0.18, // 18%
  },
  {
    domainCode: "SERVING_AND_SCALING_MODELS",
    displayName: "Serving & Scaling Models",
    weight: 0.195, // 19–20%
  },
  {
    domainCode: "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES",
    displayName: "Automating & Orchestrating ML Pipelines",
    weight: 0.215, // 21–22%
  },
  {
    domainCode: "MONITORING_ML_SOLUTIONS",
    displayName: "Monitoring ML Solutions",
    weight: 0.135, // 13–14%
  },
];

/**
 * Map of domain codes to their configuration for quick lookups
 */
export const PMLE_BLUEPRINT_MAP: Record<string, PmleDomainConfig> = 
  PMLE_BLUEPRINT.reduce((acc, config) => {
    acc[config.domainCode] = config;
    return acc;
  }, {} as Record<string, PmleDomainConfig>);

/**
 * Get domain config by code
 */
export function getPmleDomainConfig(domainCode: string): PmleDomainConfig | undefined {
  return PMLE_BLUEPRINT_MAP[domainCode];
}

/**
 * Validate that blueprint weights sum to approximately 1.0
 * (allowing for small rounding differences)
 */
export function validateBlueprintWeights(): boolean {
  const totalWeight = PMLE_BLUEPRINT.reduce((sum, config) => sum + config.weight, 0);
  // Allow 5% tolerance for rounding
  return Math.abs(totalWeight - 1.0) < 0.05;
}

