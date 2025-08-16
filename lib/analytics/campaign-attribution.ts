/**
 * Campaign attribution parameters extracted from UTM and custom parameters
 * Used for tracking beta campaign performance and A/B testing
 */
export interface CampaignParams {
  /** UTM source parameter (e.g., 'loops', 'email') */
  utm_source?: string;
  /** UTM campaign parameter (e.g., 'beta_launch_2025') */
  utm_campaign?: string;
  /** Custom campaign identifier for tracking specific campaigns */
  campaign_id?: string;
  /** A/B test variant - strictly 'A' or 'B' */
  variant?: "A" | "B";
  /** Email address for attribution (URL encoded) */
  email?: string;
}

/**
 * Supported A/B test variants for beta campaign
 */
export type CampaignVariant = "A" | "B";

/**
 * Valid UTM source values for campaign attribution
 */
export const VALID_UTM_SOURCES = ["loops", "email", "direct", "social"] as const;
export type ValidUtmSource = (typeof VALID_UTM_SOURCES)[number];

/**
 * Validates if a string is a valid campaign variant
 */
function isValidVariant(value: string | null): value is CampaignVariant {
  return value === "A" || value === "B";
}

/**
 * Safely decodes a URL parameter that might be URL encoded
 */
function safeDecodeParam(param: string | null): string | undefined {
  if (!param) return undefined;
  try {
    return decodeURIComponent(param);
  } catch {
    return param; // Return original if decode fails
  }
}

/**
 * Extracts campaign attribution parameters from a URL
 *
 * @param url - The URL to parse (can be relative or absolute)
 * @returns Campaign parameters object with undefined values for missing params
 *
 * @example
 * ```typescript
 * const params = parseCampaignParams('https://site.com/page?utm_source=loops&variant=A');
 * // Returns: { utm_source: 'loops', variant: 'A', ... }
 * ```
 */
export function parseCampaignParams(url: string): CampaignParams {
  try {
    // Handle relative URLs by providing a base URL
    const urlObj = url.startsWith("http") ? new URL(url) : new URL(url, "https://example.com");
    const params = urlObj.searchParams;

    // Extract and validate variant
    const variantParam = params.get("variant");
    const variant = isValidVariant(variantParam) ? variantParam : undefined;

    return {
      utm_source: safeDecodeParam(params.get("utm_source")),
      utm_campaign: safeDecodeParam(params.get("utm_campaign")),
      campaign_id: safeDecodeParam(params.get("campaign_id")),
      variant,
      email: safeDecodeParam(params.get("email")),
    };
  } catch (error) {
    // Invalid URL - return empty object with undefined values
    console.warn(`Failed to parse campaign parameters from URL: ${url}`, error);
    return {
      utm_source: undefined,
      utm_campaign: undefined,
      campaign_id: undefined,
      variant: undefined,
      email: undefined,
    };
  }
}
