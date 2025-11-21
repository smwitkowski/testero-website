/**
 * Configuration constants for diagnostic sessions
 * Centralized configuration for easy maintenance and testing
 */

// Re-export PMLE blueprint for convenience
export { PMLE_BLUEPRINT, PMLE_BLUEPRINT_MAP, getPmleDomainConfig } from './pmle-blueprint';

export const DIAGNOSTIC_CONFIG = {
  // Default number of questions for different contexts
  DEFAULT_QUESTION_COUNT: 5,
  BETA_QUESTION_COUNT: parseInt(process.env.NEXT_PUBLIC_BETA_QUESTION_COUNT || '5', 10),
  FULL_DIAGNOSTIC_QUESTION_COUNT: parseInt(process.env.NEXT_PUBLIC_FULL_DIAGNOSTIC_QUESTION_COUNT || '25', 10),
  
  // Question count limits for validation
  MIN_QUESTION_COUNT: 1,
  MAX_QUESTION_COUNT: parseInt(process.env.NEXT_PUBLIC_MAX_QUESTION_COUNT || '50', 10),
  
  // Session timeout in minutes
  SESSION_TIMEOUT_MINUTES: parseInt(process.env.NEXT_PUBLIC_DIAGNOSTIC_TIMEOUT_MINUTES || '30', 10),
  
  // Question selection multiplier (fetch more questions than needed for randomization)
  QUESTION_SELECTION_MULTIPLIER: 5,
} as const;

/**
 * Get the appropriate question count based on context
 */
export function getQuestionCountForContext(context: 'beta' | 'full' | 'default'): number {
  switch (context) {
    case 'beta':
      return DIAGNOSTIC_CONFIG.BETA_QUESTION_COUNT;
    case 'full':
      return DIAGNOSTIC_CONFIG.FULL_DIAGNOSTIC_QUESTION_COUNT;
    case 'default':
    default:
      return DIAGNOSTIC_CONFIG.DEFAULT_QUESTION_COUNT;
  }
}

/**
 * Validate question count is within acceptable limits
 */
export function validateQuestionCount(count: number): boolean {
  return count >= DIAGNOSTIC_CONFIG.MIN_QUESTION_COUNT && 
         count <= DIAGNOSTIC_CONFIG.MAX_QUESTION_COUNT;
}

/**
 * Get session timeout in milliseconds
 */
export function getSessionTimeoutMs(): number {
  return DIAGNOSTIC_CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000;
}