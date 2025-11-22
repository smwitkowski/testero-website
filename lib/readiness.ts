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

/**
 * Exam readiness tier color mapping.
 * 
 * Returns Tailwind color names for use in complete class names.
 * These colors are consistent across the Diagnostic Summary and Dashboard.
 * 
 * Color scheme:
 * - Low: Red (error/danger state)
 * - Building: Orange (warning/caution state)
 * - Ready: Blue (info/approaching goal)
 * - Strong: Green (success/achievement)
 */
export interface ExamReadinessTierColors {
  tailwind: string;
  text: string;
  bg: string;
  bgLight: string;
}

export function getExamReadinessTierColors(tierId: ExamReadinessTierId): ExamReadinessTierColors {
  const colorMap: Record<ExamReadinessTierId, ExamReadinessTierColors> = {
    low: { 
      tailwind: 'red', 
      text: 'text-red-700',
      bg: 'bg-red-600',
      bgLight: 'bg-red-100'
    },
    building: { 
      tailwind: 'orange', 
      text: 'text-orange-700',
      bg: 'bg-orange-600',
      bgLight: 'bg-orange-100'
    },
    ready: { 
      tailwind: 'blue', 
      text: 'text-blue-700',
      bg: 'bg-blue-600',
      bgLight: 'bg-blue-100'
    },
    strong: { 
      tailwind: 'emerald', 
      text: 'text-emerald-700',
      bg: 'bg-emerald-600',
      bgLight: 'bg-emerald-100'
    },
  };
  return colorMap[tierId];
}

/**
 * Domain tier color mapping.
 * 
 * Returns complete Tailwind class names for domain tier badges.
 * 
 * Color scheme:
 * - Critical: Red (needs immediate attention)
 * - Moderate: Amber (needs strengthening)
 * - Strong: Green (already proficient)
 */
export interface DomainTierColors {
  bg: string;
  text: string;
}

export function getDomainTierColors(tierId: DomainTierId): DomainTierColors {
  const colorMap: Record<DomainTierId, DomainTierColors> = {
    critical: { 
      bg: 'bg-red-100', 
      text: 'text-red-700' 
    },
    moderate: { 
      bg: 'bg-amber-100', 
      text: 'text-amber-700' 
    },
    strong: { 
      bg: 'bg-green-100', 
      text: 'text-green-700' 
    },
  };
  return colorMap[tierId];
}

/**
 * Get design system semantic colors for a given exam readiness tier.
 * 
 * This function is used primarily by the ReadinessMeter component for inline styles.
 * Returns hex color values from the design system for dynamic styling.
 */
export function getExamReadinessSemanticColor(tierId: ExamReadinessTierId): string {
  // Import inline to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { primitive } = require("@/lib/design-system/tokens/colors") as { primitive: { red: Record<number, string>; orange: Record<number, string>; blue: Record<number, string>; green: Record<number, string> } };
  const colorMap: Record<ExamReadinessTierId, string> = {
    low: primitive.red[500],      // red-500
    building: primitive.orange[600], // orange-600
    ready: primitive.blue[500],    // blue-500
    strong: primitive.green[500],   // green-500
  };
  return colorMap[tierId];
}

