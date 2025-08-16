/**
 * Core data structure for campaign metrics
 */
export interface CampaignMetricsData {
  emails_sent: number;
  emails_opened?: number;
  emails_clicked?: number;
  landing_page_views?: number;
  diagnostic_sessions_started?: number;
  diagnostic_sessions_completed?: number;
  bounce_rate?: number;
  unsubscribe_rate?: number;
}

/**
 * Funnel conversion metrics
 */
export interface FunnelMetrics {
  open_rate: number;
  click_through_rate: number;
  click_to_landing_rate: number;
  landing_to_diagnostic_rate: number;
  diagnostic_completion_rate: number;
  overall_conversion_rate: number;
  total_dropoff: number;
  largest_dropoff_stage: string;
  largest_dropoff_amount: number;
}

/**
 * A/B test variant comparison results
 */
export interface VariantComparison {
  variant_a_conversion_rate: number;
  variant_b_conversion_rate: number;
  conversion_rate_lift: number;
  relative_lift_percentage: number;
  winner: "A" | "B" | "tie";
  statistical_significance: boolean;
  confidence_level?: number;
}

/**
 * Time-based conversion rate analysis
 */
export interface ConversionRates {
  hourly_rates: Array<{ timestamp: number; rate: number }>;
  current_rate: number;
  average_rate: number;
  trend: "improving" | "declining" | "stable";
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  timestamp: number;
  emails_sent: number;
  completed: number;
}

/**
 * Event data structure for aggregation
 */
export interface EventData {
  event: string;
  properties: {
    campaign_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Loops email platform data structure
 */
export interface LoopsData {
  emails_sent: number;
  emails_opened?: number;
  emails_clicked?: number;
  bounce_rate?: number;
  unsubscribe_rate?: number;
}

/**
 * Safely calculates percentage, handling division by zero
 */
function safePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // Round to 2 decimal places
}

/**
 * Calculates comprehensive funnel metrics for a campaign
 */
export function calculateCampaignFunnelMetrics(data: CampaignMetricsData): FunnelMetrics {
  const {
    emails_sent,
    emails_opened = 0,
    emails_clicked = 0,
    landing_page_views = 0,
    diagnostic_sessions_started = 0,
    diagnostic_sessions_completed = 0,
  } = data;

  // Calculate basic conversion rates
  const open_rate = safePercentage(emails_opened, emails_sent);
  const click_through_rate = safePercentage(emails_clicked, emails_sent);
  const click_to_landing_rate = safePercentage(landing_page_views, emails_clicked);
  const landing_to_diagnostic_rate = safePercentage(
    diagnostic_sessions_started,
    landing_page_views
  );
  const diagnostic_completion_rate = safePercentage(
    diagnostic_sessions_completed,
    diagnostic_sessions_started
  );
  const overall_conversion_rate = safePercentage(diagnostic_sessions_completed, emails_sent);

  // Calculate dropoff analysis
  const total_dropoff = safePercentage(emails_sent - diagnostic_sessions_completed, emails_sent);

  // Find largest dropoff stage
  const dropoffs = [
    { stage: "email_open", amount: emails_sent - emails_opened },
    { stage: "email_click", amount: emails_opened - emails_clicked },
    { stage: "click_to_landing", amount: emails_clicked - landing_page_views },
    { stage: "landing_to_diagnostic", amount: landing_page_views - diagnostic_sessions_started },
    {
      stage: "diagnostic_completion",
      amount: diagnostic_sessions_started - diagnostic_sessions_completed,
    },
  ];

  const largestDropoff = dropoffs.reduce((max, current) =>
    current.amount > max.amount ? current : max
  );

  return {
    open_rate,
    click_through_rate,
    click_to_landing_rate,
    landing_to_diagnostic_rate,
    diagnostic_completion_rate,
    overall_conversion_rate,
    total_dropoff,
    largest_dropoff_stage: largestDropoff.stage,
    largest_dropoff_amount: largestDropoff.amount,
  };
}

/**
 * Compares two campaign variants for A/B testing
 */
export function calculateVariantComparison(
  variantA: Partial<CampaignMetricsData>,
  variantB: Partial<CampaignMetricsData>
): VariantComparison {
  const aConversionRate = safePercentage(
    variantA.diagnostic_sessions_completed || 0,
    variantA.emails_sent || 0
  );

  const bConversionRate = safePercentage(
    variantB.diagnostic_sessions_completed || 0,
    variantB.emails_sent || 0
  );

  const conversion_rate_lift = Math.round((aConversionRate - bConversionRate) * 100) / 100;
  const relative_lift_percentage = safePercentage(
    Math.abs(conversion_rate_lift),
    Math.min(aConversionRate, bConversionRate)
  );

  let winner: "A" | "B" | "tie" = "tie";
  if (aConversionRate > bConversionRate) winner = "A";
  else if (bConversionRate > aConversionRate) winner = "B";

  // Simple statistical significance calculation (z-test for proportions)
  const totalA = variantA.emails_sent || 0;
  const totalB = variantB.emails_sent || 0;
  const successA = variantA.diagnostic_sessions_completed || 0;
  const successB = variantB.diagnostic_sessions_completed || 0;

  let statistical_significance = false;
  let confidence_level: number | undefined;

  if (totalA > 30 && totalB > 30) {
    // Basic sample size requirement
    const p1 = successA / totalA;
    const p2 = successB / totalB;
    const pooled = (successA + successB) / (totalA + totalB);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB));
    const z = Math.abs(p1 - p2) / se;

    // z > 1.96 indicates 95% confidence
    if (z > 1.96) {
      statistical_significance = true;
      confidence_level = 95 + (z - 1.96) * 2.5; // Rough confidence level
      confidence_level = Math.min(confidence_level, 99.9);
    }
  }

  return {
    variant_a_conversion_rate: aConversionRate,
    variant_b_conversion_rate: bConversionRate,
    conversion_rate_lift,
    relative_lift_percentage,
    winner,
    statistical_significance,
    confidence_level,
  };
}

/**
 * Calculates time-based conversion rates and trends
 */
export function calculateConversionRates(timeSeriesData: TimeSeriesDataPoint[]): ConversionRates {
  // Sort by timestamp (most recent first)
  const sortedData = [...timeSeriesData].sort((a, b) => b.timestamp - a.timestamp);

  const hourly_rates = sortedData.map((point) => ({
    timestamp: point.timestamp,
    rate: safePercentage(point.completed, point.emails_sent),
  }));

  const current_rate = hourly_rates[0]?.rate || 0;

  // Calculate average rate across all time periods
  const totalCompleted = sortedData.reduce((sum, point) => sum + point.completed, 0);
  const totalSent = sortedData.reduce((sum, point) => sum + point.emails_sent, 0);
  const average_rate = safePercentage(totalCompleted, totalSent);

  // Determine trend
  let trend: "improving" | "declining" | "stable" = "stable";
  const tolerance = 0.5; // 0.5% tolerance for "stable"

  if (current_rate > average_rate + tolerance) {
    trend = "improving";
  } else if (current_rate < average_rate - tolerance) {
    trend = "declining";
  }

  return {
    hourly_rates,
    current_rate,
    average_rate,
    trend,
  };
}

/**
 * Aggregates campaign data from multiple sources (Loops + PostHog)
 */
export function aggregateCampaignData(
  loopsData: Partial<LoopsData>,
  posthogEvents: EventData[],
  campaignId?: string
): CampaignMetricsData {
  // Filter PostHog events by campaign ID if provided
  const relevantEvents = campaignId
    ? posthogEvents.filter((event) => event.properties.campaign_id === campaignId)
    : posthogEvents;

  // Count specific event types
  const landing_page_views = relevantEvents.filter(
    (event) => event.event === "email_campaign_landing"
  ).length;

  const diagnostic_sessions_started = relevantEvents.filter(
    (event) => event.event === "diagnostic_started"
  ).length;

  const diagnostic_sessions_completed = relevantEvents.filter(
    (event) => event.event === "diagnostic_completed"
  ).length;

  return {
    emails_sent: loopsData.emails_sent || 0,
    emails_opened: loopsData.emails_opened || 0,
    emails_clicked: loopsData.emails_clicked || 0,
    landing_page_views,
    diagnostic_sessions_started,
    diagnostic_sessions_completed,
    bounce_rate: loopsData.bounce_rate,
    unsubscribe_rate: loopsData.unsubscribe_rate,
  };
}
