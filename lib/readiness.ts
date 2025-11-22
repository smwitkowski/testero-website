/**
 * Shared readiness tier helpers for exam and domain scores.
 * 
 * Centralizes the logic for readiness labels and domain tiers so Diagnostic Results
 * and Dashboard stay consistent and easy to tweak.
 * 
 * Exam Readiness Thresholds:
 * - <40: Low - Needs significant improvement
 * - 40-69: Building - Making progress, focus on weak areas
 * - 70-84: Ready - Approaching exam readiness
 * - 85+: Strong - Well-prepared for the exam
 * 
 * Domain Tier Thresholds:
 * - <40: Critical - Critical gaps that need immediate attention
 * - 40-69: Moderate - Important topics that need strengthening
 * - 70+: Strong - Areas where you're already strong
 */

export type ExamReadinessTierId = "low" | "building" | "ready" | "strong";
export type DomainTierId = "critical" | "moderate" | "strong";

export interface ExamReadinessTier {
  id: ExamReadinessTierId;
  label: string;
  description: string;
}

export interface DomainTier {
  id: DomainTierId;
  label: string;
}

// Exam readiness thresholds
const EXAM_LOW_THRESHOLD = 40;
const EXAM_BUILDING_THRESHOLD = 70;
const EXAM_READY_THRESHOLD = 85;

// Domain tier thresholds
const DOMAIN_CRITICAL_THRESHOLD = 40;
const DOMAIN_MODERATE_THRESHOLD = 70;

/**
 * Get the exam readiness tier for a given score.
 * 
 * @param score - Exam readiness score (0-100)
 * @returns Exam readiness tier with id, label, and description
 */
export function getExamReadinessTier(score: number): ExamReadinessTier {
  if (score < EXAM_LOW_THRESHOLD) {
    return {
      id: "low",
      label: "Low",
      description: "Needs significant improvement. Focus on foundational concepts and consistent practice.",
    };
  }
  
  if (score < EXAM_BUILDING_THRESHOLD) {
    return {
      id: "building",
      label: "Building",
      description: "Making progress. Focus on weak areas to reach exam readiness.",
    };
  }
  
  if (score < EXAM_READY_THRESHOLD) {
    return {
      id: "ready",
      label: "Ready",
      description: "Approaching exam readiness. Keep practicing to maintain and strengthen your knowledge.",
    };
  }
  
  return {
    id: "strong",
    label: "Strong",
    description: "Well-prepared for the exam. Continue practicing to maintain your knowledge.",
  };
}

/**
 * Get the domain tier for a given domain score.
 * 
 * @param score - Domain score percentage (0-100)
 * @returns Domain tier with id and label
 */
export function getDomainTier(score: number): DomainTier {
  if (score < DOMAIN_CRITICAL_THRESHOLD) {
    return {
      id: "critical",
      label: "Critical",
    };
  }
  
  if (score < DOMAIN_MODERATE_THRESHOLD) {
    return {
      id: "moderate",
      label: "Moderate",
    };
  }
  
  return {
    id: "strong",
    label: "Strong",
  };
}

