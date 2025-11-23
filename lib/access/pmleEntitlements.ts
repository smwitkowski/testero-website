/**
 * PMLE Access & Entitlements Helper
 * 
 * Centralizes PMLE access logic for anonymous users, free accounts, and subscribers
 * so gating is consistent across diagnostic summary, practice, and dashboard.
 * 
 * Usage:
 * - Server-side: Use `getPmleAccessLevelForRequest()` to get access level from a Request
 * - Client-side: Use `getPmleAccessLevelForUser()` with billing status from `/api/billing/status`
 * - Check feature access: Use `canUseFeature(accessLevel, feature)` for gating decisions
 * 
 * Adding new exams or features:
 * 1. Add new feature to `PmleFeature` type
 * 2. Update `FEATURE_MATRIX` with access rules for the new feature
 * 3. Update this documentation with the new feature's behavior
 */

import type { User } from "@supabase/supabase-js";
import type { BillingStatusResponse } from "@/app/api/billing/status/route";

/**
 * Access levels for PMLE users
 * - ANONYMOUS: No account (not logged in)
 * - FREE: Logged in, no active subscription
 * - SUBSCRIBER: Has active or trialing subscription (status in ("active","trialing"))
 */
export type AccessLevel = "ANONYMOUS" | "FREE" | "SUBSCRIBER";

/**
 * PMLE features that can be gated by access level
 * - DIAGNOSTIC_RUN: Ability to start/run a diagnostic test
 * - DIAGNOSTIC_SUMMARY_BASIC: View basic diagnostic summary (score, domain breakdown)
 * - DIAGNOSTIC_SUMMARY_FULL: View full diagnostic summary including question-level details
 * - EXPLANATIONS: Access to question explanations in diagnostic results
 * - PRACTICE_SESSION: Create unlimited, domain-targeted practice sessions
 * - PRACTICE_SESSION_FREE_QUOTA: Create limited practice sessions (free tier quota)
 */
export type PmleFeature =
  | "DIAGNOSTIC_RUN"
  | "DIAGNOSTIC_SUMMARY_BASIC"
  | "DIAGNOSTIC_SUMMARY_FULL"
  | "EXPLANATIONS"
  | "PRACTICE_SESSION"
  | "PRACTICE_SESSION_FREE_QUOTA";

/**
 * Feature access matrix encoding Week 4 rules:
 * 
 * ANONYMOUS:
 * - ✅ DIAGNOSTIC_RUN: 1 diagnostic run allowed
 * - ✅ DIAGNOSTIC_SUMMARY_BASIC: Can view basic summary (score + domain breakdown)
 * - ❌ DIAGNOSTIC_SUMMARY_FULL: Cannot view full summary with question details
 * - ❌ EXPLANATIONS: No explanations access
 * - ❌ PRACTICE_SESSION: No unlimited practice
 * - ❌ PRACTICE_SESSION_FREE_QUOTA: No free practice quota
 * 
 * FREE (logged in, no subscription):
 * - ✅ DIAGNOSTIC_RUN: Can run diagnostics
 * - ✅ DIAGNOSTIC_SUMMARY_BASIC: Can view basic summary
 * - ✅ DIAGNOSTIC_SUMMARY_FULL: Can view full summary with question details
 * - ❌ EXPLANATIONS: No explanations (paid feature)
 * - ❌ PRACTICE_SESSION: No unlimited practice
 * - ✅ PRACTICE_SESSION_FREE_QUOTA: Limited practice quota (e.g., ~5 questions per week)
 * 
 * SUBSCRIBER (active or trialing subscription):
 * - ✅ All features: Full access to everything
 */
const FEATURE_MATRIX: Record<AccessLevel, Record<PmleFeature, boolean>> = {
  ANONYMOUS: {
    DIAGNOSTIC_RUN: true,
    DIAGNOSTIC_SUMMARY_BASIC: true,
    DIAGNOSTIC_SUMMARY_FULL: false,
    EXPLANATIONS: false,
    PRACTICE_SESSION: false,
    PRACTICE_SESSION_FREE_QUOTA: false,
  },
  FREE: {
    DIAGNOSTIC_RUN: true,
    DIAGNOSTIC_SUMMARY_BASIC: true,
    DIAGNOSTIC_SUMMARY_FULL: true,
    EXPLANATIONS: false,
    PRACTICE_SESSION: false,
    PRACTICE_SESSION_FREE_QUOTA: true,
  },
  SUBSCRIBER: {
    DIAGNOSTIC_RUN: true,
    DIAGNOSTIC_SUMMARY_BASIC: true,
    DIAGNOSTIC_SUMMARY_FULL: true,
    EXPLANATIONS: true,
    PRACTICE_SESSION: true,
    PRACTICE_SESSION_FREE_QUOTA: true,
  },
};

/**
 * Determines access level from user and subscription status
 * 
 * @param params - Object containing user and subscription status
 * @param params.user - Supabase user object (null if anonymous)
 * @param params.isSubscriber - Whether user has active/trialing subscription
 * @returns AccessLevel - "ANONYMOUS", "FREE", or "SUBSCRIBER"
 */
export function getAccessLevel({
  user,
  isSubscriber,
}: {
  user: User | null;
  isSubscriber: boolean;
}): AccessLevel {
  if (!user) {
    return "ANONYMOUS";
  }

  if (isSubscriber) {
    return "SUBSCRIBER";
  }

  return "FREE";
}

/**
 * Checks if a given access level can use a specific PMLE feature
 * 
 * @param accessLevel - The user's access level
 * @param feature - The feature to check access for
 * @returns boolean - true if access is allowed, false otherwise
 */
export function canUseFeature(
  accessLevel: AccessLevel,
  feature: PmleFeature
): boolean {
  return FEATURE_MATRIX[accessLevel][feature];
}

/**
 * Client-side helper to get PMLE access level from user and billing status
 * 
 * @param user - Supabase user object (null if anonymous)
 * @param billingStatus - Billing status from `/api/billing/status` (null if not fetched)
 * @returns AccessLevel - Computed access level
 */
export function getPmleAccessLevelForUser(
  user: User | null,
  billingStatus: BillingStatusResponse | null
): AccessLevel {
  const isSubscriber = billingStatus?.isSubscriber ?? false;
  return getAccessLevel({ user, isSubscriber });
}

