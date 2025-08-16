/**
 * PostHog Dashboard Integration for Campaign Analytics
 *
 * This module provides functions to create and manage PostHog dashboards
 * specifically for email campaign tracking and performance analysis.
 */

/**
 * Configuration for creating a campaign dashboard
 */
export interface CampaignDashboardConfig {
  name: string;
  description?: string;
  campaignId: string;
  insightConfigs: CampaignInsightConfig[];
}

/**
 * Configuration for individual campaign insights
 */
export interface CampaignInsightConfig {
  name: string;
  description?: string;
  query: string;
  dateRange?: {
    date_from: string;
    date_to: string;
  };
}

/**
 * Result of dashboard creation
 */
export interface CampaignDashboardResult {
  dashboardId: string;
  dashboardUrl: string;
  insights: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}

/**
 * Result of insight creation
 */
export interface CampaignInsightResult {
  id: string;
  name: string;
  short_id?: string;
}

/**
 * Result of campaign insights query
 */
export interface CampaignInsightsResult {
  query: string;
  results: Array<Record<string, any>>;
}

/**
 * Result of dashboard update
 */
export interface CampaignDashboardUpdateResult {
  dashboardId: string;
  newInsightId: string;
  totalInsights: number;
}

/**
 * PostHog MCP interface for type safety
 */
export interface PostHogMCP {
  "insight-create-from-query": (params: any) => Promise<any>;
  "dashboard-create": (params: any) => Promise<any>;
  "dashboard-get": (params: any) => Promise<any>;
  "add-insight-to-dashboard": (params: any) => Promise<any>;
  "get-sql-insight": (params: any) => Promise<any>;
}

/**
 * Creates a complete campaign dashboard with all insights
 */
export async function createCampaignDashboard(
  posthogMCP: PostHogMCP,
  config: CampaignDashboardConfig
): Promise<CampaignDashboardResult> {
  // Create the dashboard first
  const dashboardResponse = await posthogMCP["dashboard-create"]({
    data: {
      name: config.name,
      description: config.description,
      pinned: true,
      tags: ["campaign", "beta", "email"],
    },
  });

  const dashboardId = dashboardResponse.id;
  const dashboardUrl = dashboardResponse.url || `https://app.posthog.com/dashboard/${dashboardId}`;

  // Create all insights and add them to the dashboard
  const insights: Array<{ id: string; name: string; url: string }> = [];

  for (const insightConfig of config.insightConfigs) {
    const insightResult = await createCampaignInsights(posthogMCP, insightConfig);

    // Add insight to dashboard
    await posthogMCP["add-insight-to-dashboard"]({
      data: {
        dashboardId: dashboardId,
        insightId: insightResult.id,
      },
    });

    insights.push({
      id: insightResult.id,
      name: insightResult.name,
      url: `https://app.posthog.com/insights/${insightResult.id}`,
    });
  }

  return {
    dashboardId,
    dashboardUrl,
    insights,
  };
}

/**
 * Creates individual insights with proper HogQL queries
 */
export async function createCampaignInsights(
  posthogMCP: PostHogMCP,
  config: CampaignInsightConfig
): Promise<CampaignInsightResult> {
  const dateRange = config.dateRange || {
    date_from: "-30d",
    date_to: "now",
  };

  const response = await posthogMCP["insight-create-from-query"]({
    data: {
      name: config.name,
      description: config.description,
      query: {
        kind: "DataVisualizationNode",
        source: {
          kind: "HogQLQuery",
          query: config.query,
          filters: {
            dateRange,
          },
        },
      },
      saved: true,
      favorited: false,
      tags: ["campaign"],
    },
  });

  return {
    id: response.id,
    name: response.name,
    short_id: response.short_id,
  };
}

/**
 * Retrieves campaign data using natural language queries
 */
export async function getCampaignInsights(
  posthogMCP: PostHogMCP,
  naturalLanguageQuery: string
): Promise<CampaignInsightsResult> {
  const response = await posthogMCP["get-sql-insight"]({
    query: naturalLanguageQuery,
  });

  return {
    query: response.query,
    results: response.results,
  };
}

/**
 * Updates existing dashboard with new insights
 */
export async function updateCampaignDashboard(
  posthogMCP: PostHogMCP,
  dashboardId: string,
  newInsightConfig: CampaignInsightConfig
): Promise<CampaignDashboardUpdateResult> {
  // Get current dashboard to count existing insights
  const dashboardData = await posthogMCP["dashboard-get"]({
    dashboardId: parseInt(dashboardId.replace("dashboard_", "")),
  });

  // Create the new insight
  const newInsight = await createCampaignInsights(posthogMCP, newInsightConfig);

  // Add insight to dashboard
  await posthogMCP["add-insight-to-dashboard"]({
    data: {
      dashboardId: dashboardId,
      insightId: newInsight.id,
    },
  });

  return {
    dashboardId,
    newInsightId: newInsight.id,
    totalInsights: (dashboardData.insights?.length || 0) + 1,
  };
}
