/**
 * Helper utilities for beta variant analytics tracking
 * Provides consistent beta variant detection and event properties
 */

// Type for user object (simplified from Supabase auth)
interface User {
  id: string;
  user_metadata?: {
    beta_variant?: "A" | "B";
    [key: string]: any;
  };
}

/**
 * Extract beta variant from user metadata for analytics tracking
 * @param user - Authenticated user object from Supabase
 * @returns Beta variant ('A' | 'B') or null if not assigned
 */
export function getBetaVariantForAnalytics(user: User | null): "A" | "B" | null {
  if (!user?.user_metadata?.beta_variant) {
    return null;
  }

  const variant = user.user_metadata.beta_variant;

  // Validate the variant is one of the expected values
  if (variant === "A" || variant === "B") {
    return variant;
  }

  // Log unexpected variant values for debugging
  console.warn(`Unexpected beta variant value: ${variant}`);
  return null;
}

/**
 * Create standardized beta variant properties for analytics events
 * @param user - Authenticated user object
 * @param additionalProps - Additional properties to merge
 * @returns Object with beta_variant and merged properties
 */
export function createBetaVariantAnalyticsProps(
  user: User | null,
  additionalProps: Record<string, any> = {}
): Record<string, any> {
  const beta_variant = getBetaVariantForAnalytics(user);

  return {
    beta_variant,
    ...additionalProps,
  };
}

/**
 * Check if user is part of any beta variant
 * @param user - Authenticated user object
 * @returns true if user has a beta variant assigned
 */
export function isUserInBetaVariant(user: User | null): boolean {
  return getBetaVariantForAnalytics(user) !== null;
}

/**
 * Get beta variant with fallback for analytics
 * Useful when you need a string value rather than null
 * @param user - Authenticated user object
 * @param fallback - Fallback value if no variant assigned
 * @returns Beta variant or fallback value
 */
export function getBetaVariantWithFallback(
  user: User | null,
  fallback: string = "unknown"
): string {
  return getBetaVariantForAnalytics(user) || fallback;
}
