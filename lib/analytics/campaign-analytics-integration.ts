import {
  parseCampaignParams,
  storeCampaignAttribution,
  getCampaignAttribution,
  addCampaignAttributionToEvent,
  CampaignParams,
} from "./campaign-attribution";
import { trackEvent, ANALYTICS_EVENTS, PostHogClient, AnalyticsEvent } from "./analytics";

/**
 * Tracks email campaign landing with attribution
 *
 * @param posthog - PostHog client (server or client-side)
 * @param campaignParams - Campaign attribution parameters
 * @param userId - User ID for server-side tracking
 */
export function trackCampaignLanding(
  posthog: PostHogClient,
  campaignParams: CampaignParams,
  userId?: string
): void {
  if (!posthog) return;

  const eventProperties = {
    ...campaignParams,
    landing_page: typeof window !== "undefined" ? window.location.pathname : "/beta/welcome",
    timestamp: Date.now(),
  };

  trackEvent(posthog, ANALYTICS_EVENTS.EMAIL_CAMPAIGN_LANDING, eventProperties, userId);
}

/**
 * Tracks diagnostic start event enhanced with campaign attribution
 *
 * @param posthog - PostHog client
 * @param diagnosticData - Base diagnostic event data
 * @param userId - User ID for server-side tracking
 */
export function trackDiagnosticStartWithCampaign(
  posthog: PostHogClient,
  diagnosticData: Record<string, any>,
  userId?: string
): void {
  if (!posthog) return;

  const enhancedEvent = addCampaignAttributionToEvent(diagnosticData);
  trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_STARTED, enhancedEvent, userId);
}

/**
 * Tracks diagnostic completion event enhanced with campaign attribution
 *
 * @param posthog - PostHog client
 * @param completionData - Base diagnostic completion data
 * @param userId - User ID for server-side tracking
 */
export function trackDiagnosticCompleteWithCampaign(
  posthog: PostHogClient,
  completionData: Record<string, any>,
  userId?: string
): void {
  if (!posthog) return;

  const enhancedEvent = addCampaignAttributionToEvent(completionData);
  trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_COMPLETED, enhancedEvent, userId);
}

/**
 * Extracts campaign attribution from current URL and stores it
 *
 * @param posthog - Optional PostHog client to track attribution event
 * @param userId - User ID for server-side tracking
 * @returns Campaign parameters or null if none found
 */
export function setCampaignAttributionFromURL(
  posthog?: PostHogClient,
  userId?: string
): CampaignParams | null {
  if (typeof window === "undefined") return null;

  const currentUrl = window.location.href;
  const campaignParams = parseCampaignParams(currentUrl);

  // Check if any campaign parameters exist
  const hasParams = Object.values(campaignParams).some((value) => value !== undefined);

  if (!hasParams) return null;

  // Store attribution
  storeCampaignAttribution(campaignParams);

  // Track attribution event if PostHog is provided
  if (posthog) {
    trackEvent(
      posthog,
      ANALYTICS_EVENTS.CAMPAIGN_ATTRIBUTION_SET,
      {
        ...campaignParams,
        source_url: currentUrl,
      },
      userId
    );
  }

  return campaignParams;
}

/**
 * Creates an enhanced track event function that automatically adds campaign attribution
 *
 * @param posthog - PostHog client to use
 * @returns Enhanced tracking function
 */
export function createEnhancedTrackEvent(posthog: PostHogClient) {
  return function enhancedTrackEvent(
    event: AnalyticsEvent,
    properties?: Record<string, any>,
    userId?: string
  ): void {
    if (!posthog) return;

    const enhancedProperties = addCampaignAttributionToEvent(properties || {});
    trackEvent(posthog, event, enhancedProperties, userId);
  };
}
