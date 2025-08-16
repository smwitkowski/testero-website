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

/**
 * Storage key for campaign attribution in sessionStorage
 */
const CAMPAIGN_ATTRIBUTION_KEY = "testero_campaign_attribution";

/**
 * Stores campaign attribution parameters in sessionStorage
 *
 * @param attribution - Campaign parameters to store
 * @param merge - If true, merge with existing attribution instead of replacing
 */
export function storeCampaignAttribution(attribution: CampaignParams, merge = false): void {
  if (typeof window === "undefined") return; // SSR safety

  try {
    let dataToStore = attribution;

    if (merge) {
      const existing = getCampaignAttribution();
      if (existing) {
        dataToStore = { ...existing, ...attribution };
      }
    }

    window.sessionStorage.setItem(CAMPAIGN_ATTRIBUTION_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    console.warn("Failed to store campaign attribution:", error);
  }
}

/**
 * Retrieves campaign attribution parameters from sessionStorage
 *
 * @returns Campaign parameters or null if none stored/error
 */
export function getCampaignAttribution(): CampaignParams | null {
  if (typeof window === "undefined") return null; // SSR safety

  try {
    const stored = window.sessionStorage.getItem(CAMPAIGN_ATTRIBUTION_KEY);
    if (!stored) return null;

    return JSON.parse(stored) as CampaignParams;
  } catch (error) {
    console.warn("Failed to retrieve campaign attribution:", error);
    return null;
  }
}

/**
 * Clears campaign attribution from sessionStorage
 */
export function clearCampaignAttribution(): void {
  if (typeof window === "undefined") return; // SSR safety

  try {
    window.sessionStorage.removeItem(CAMPAIGN_ATTRIBUTION_KEY);
  } catch (error) {
    console.warn("Failed to clear campaign attribution:", error);
  }
}

/**
 * Adds campaign attribution to an analytics event object
 * Only adds values that don't already exist in the event
 *
 * @param event - The analytics event object
 * @returns Enhanced event with campaign attribution
 */
export function addCampaignAttributionToEvent<T extends Record<string, any>>(event: T): T {
  const attribution = getCampaignAttribution();
  if (!attribution) return event;

  const enhanced = { ...event } as T;

  // Only add attribution values that aren't already in the event and aren't undefined
  Object.entries(attribution).forEach(([key, value]) => {
    if (value !== undefined && !(key in enhanced)) {
      (enhanced as any)[key] = value;
    }
  });

  return enhanced;
}
