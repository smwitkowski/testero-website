/**
 * Script to create the beta campaign dashboard in PostHog
 *
 * This script uses the PostHog MCP to create a comprehensive dashboard
 * for tracking our beta email campaign performance.
 */

import {
  createCampaignDashboard,
  CampaignDashboardConfig,
} from "@/lib/analytics/campaign-dashboard-integration";

// PostHog MCP would be injected at runtime
declare const mcp__posthog: any;

/**
 * Configuration for the beta campaign dashboard
 */
const BETA_CAMPAIGN_DASHBOARD_CONFIG: CampaignDashboardConfig = {
  name: "Beta Email Campaign Analytics",
  description: "Comprehensive tracking for beta launch email campaign with A/B testing insights",
  campaignId: "beta_75_test",
  insightConfigs: [
    {
      name: "📧 Email Campaign Funnel",
      description: "Complete funnel from email send to diagnostic completion",
      query: `
        WITH campaign_events AS (
          SELECT 
            distinct_id,
            event,
            timestamp,
            properties.variant as variant,
            properties.utm_source as utm_source,
            properties.email as email
          FROM events 
          WHERE properties.campaign_id = 'beta_75_test'
          AND timestamp >= now() - interval 30 day
        ),
        funnel_metrics AS (
          SELECT 
            COUNT(DISTINCT CASE WHEN event = 'email_campaign_landing' THEN distinct_id END) as email_clicks,
            COUNT(DISTINCT CASE WHEN event = 'diagnostic_started' THEN distinct_id END) as diagnostic_starts,
            COUNT(DISTINCT CASE WHEN event = 'diagnostic_completed' THEN distinct_id END) as diagnostic_completions
          FROM campaign_events
        )
        SELECT 
          email_clicks,
          diagnostic_starts,
          diagnostic_completions,
          ROUND((diagnostic_starts::float / email_clicks::float) * 100, 2) as click_to_start_rate,
          ROUND((diagnostic_completions::float / diagnostic_starts::float) * 100, 2) as completion_rate,
          ROUND((diagnostic_completions::float / email_clicks::float) * 100, 2) as overall_conversion_rate
        FROM funnel_metrics
      `,
    },
    {
      name: "🔀 A/B Variant Performance",
      description: "Conversion rates and statistical significance by A/B test variant",
      query: `
        WITH variant_performance AS (
          SELECT 
            properties.variant as variant,
            COUNT(DISTINCT CASE WHEN event = 'email_campaign_landing' THEN distinct_id END) as clicks,
            COUNT(DISTINCT CASE WHEN event = 'diagnostic_started' THEN distinct_id END) as starts,
            COUNT(DISTINCT CASE WHEN event = 'diagnostic_completed' THEN distinct_id END) as completions
          FROM events 
          WHERE properties.campaign_id = 'beta_75_test'
          AND properties.variant IS NOT NULL
          AND timestamp >= now() - interval 30 day
          GROUP BY variant
        )
        SELECT 
          variant,
          clicks,
          starts,
          completions,
          ROUND((completions::float / clicks::float) * 100, 2) as conversion_rate,
          ROUND((starts::float / clicks::float) * 100, 2) as click_to_start_rate,
          ROUND((completions::float / starts::float) * 100, 2) as start_to_completion_rate
        FROM variant_performance
        ORDER BY variant
      `,
    },
    {
      name: "📊 Daily Campaign Metrics",
      description: "Campaign performance trends over time",
      query: `
        SELECT 
          toDate(timestamp) as date,
          COUNT(DISTINCT CASE WHEN event = 'email_campaign_landing' THEN distinct_id END) as daily_clicks,
          COUNT(DISTINCT CASE WHEN event = 'diagnostic_started' THEN distinct_id END) as daily_starts,
          COUNT(DISTINCT CASE WHEN event = 'diagnostic_completed' THEN distinct_id END) as daily_completions,
          ROUND(
            (COUNT(DISTINCT CASE WHEN event = 'diagnostic_completed' THEN distinct_id END)::float / 
             COUNT(DISTINCT CASE WHEN event = 'email_campaign_landing' THEN distinct_id END)::float) * 100, 
            2
          ) as daily_conversion_rate
        FROM events 
        WHERE properties.campaign_id = 'beta_75_test'
        AND timestamp >= now() - interval 30 day
        GROUP BY date
        HAVING daily_clicks > 0
        ORDER BY date DESC
      `,
    },
    {
      name: "🎯 User Journey Analysis",
      description: "Detailed user journey from email click to completion",
      query: `
        WITH user_journeys AS (
          SELECT 
            distinct_id,
            properties.variant as variant,
            properties.email as email,
            MIN(CASE WHEN event = 'email_campaign_landing' THEN timestamp END) as landing_time,
            MIN(CASE WHEN event = 'diagnostic_started' THEN timestamp END) as start_time,
            MIN(CASE WHEN event = 'diagnostic_completed' THEN timestamp END) as completion_time
          FROM events 
          WHERE properties.campaign_id = 'beta_75_test'
          AND timestamp >= now() - interval 30 day
          GROUP BY distinct_id, variant, email
        )
        SELECT 
          variant,
          COUNT(*) as total_users,
          COUNT(CASE WHEN landing_time IS NOT NULL THEN 1 END) as landed_users,
          COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as started_users,
          COUNT(CASE WHEN completion_time IS NOT NULL THEN 1 END) as completed_users,
          ROUND(AVG(CASE 
            WHEN start_time IS NOT NULL AND landing_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (start_time - landing_time))/60.0 
          END), 2) as avg_landing_to_start_minutes,
          ROUND(AVG(CASE 
            WHEN completion_time IS NOT NULL AND start_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completion_time - start_time))/60.0 
          END), 2) as avg_diagnostic_duration_minutes
        FROM user_journeys
        WHERE variant IS NOT NULL
        GROUP BY variant
        ORDER BY variant
      `,
    },
    {
      name: "📈 Cumulative Performance",
      description: "Cumulative metrics showing campaign performance over time",
      query: `
        WITH daily_events AS (
          SELECT 
            toDate(timestamp) as date,
            event,
            properties.variant as variant,
            COUNT(DISTINCT distinct_id) as daily_users
          FROM events 
          WHERE properties.campaign_id = 'beta_75_test'
          AND timestamp >= now() - interval 30 day
          GROUP BY date, event, variant
        ),
        cumulative_metrics AS (
          SELECT 
            date,
            variant,
            SUM(CASE WHEN event = 'email_campaign_landing' THEN daily_users ELSE 0 END) 
              OVER (PARTITION BY variant ORDER BY date ROWS UNBOUNDED PRECEDING) as cumulative_clicks,
            SUM(CASE WHEN event = 'diagnostic_started' THEN daily_users ELSE 0 END) 
              OVER (PARTITION BY variant ORDER BY date ROWS UNBOUNDED PRECEDING) as cumulative_starts,
            SUM(CASE WHEN event = 'diagnostic_completed' THEN daily_users ELSE 0 END) 
              OVER (PARTITION BY variant ORDER BY date ROWS UNBOUNDED PRECEDING) as cumulative_completions
          FROM daily_events
        )
        SELECT DISTINCT
          date,
          variant,
          cumulative_clicks,
          cumulative_starts,
          cumulative_completions,
          ROUND((cumulative_completions::float / cumulative_clicks::float) * 100, 2) as cumulative_conversion_rate
        FROM cumulative_metrics
        WHERE variant IS NOT NULL
        ORDER BY date DESC, variant
      `,
    },
  ],
};

/**
 * Main function to create the campaign dashboard
 */
async function createBetaCampaignDashboard() {
  try {
    console.log("🚀 Creating Beta Campaign Dashboard in PostHog...");

    const result = await createCampaignDashboard(mcp__posthog, BETA_CAMPAIGN_DASHBOARD_CONFIG);

    console.log("✅ Dashboard created successfully!");
    console.log(`📊 Dashboard ID: ${result.dashboardId}`);
    console.log(`🔗 Dashboard URL: ${result.dashboardUrl}`);
    console.log(`📈 Total Insights: ${result.insights.length}`);

    console.log("\n📊 Created Insights:");
    result.insights.forEach((insight, index) => {
      console.log(`  ${index + 1}. ${insight.name}`);
      console.log(`     🔗 ${insight.url}`);
    });

    console.log("\n🎉 Campaign dashboard is ready for beta launch tracking!");

    return result;
  } catch (error) {
    console.error("❌ Failed to create campaign dashboard:", error);
    throw error;
  }
}

/**
 * Function to add additional insights to existing dashboard
 */
async function addCustomInsight(dashboardId: string, insightName: string, query: string) {
  const { updateCampaignDashboard } = await import(
    "@/lib/analytics/campaign-dashboard-integration"
  );

  try {
    const result = await updateCampaignDashboard(mcp__posthog, dashboardId, {
      name: insightName,
      description: `Custom insight: ${insightName}`,
      query,
    });

    console.log(`✅ Added custom insight: ${insightName}`);
    console.log(`📊 Total insights now: ${result.totalInsights}`);

    return result;
  } catch (error) {
    console.error(`❌ Failed to add custom insight:`, error);
    throw error;
  }
}

// Export functions for use in other contexts
export { createBetaCampaignDashboard, addCustomInsight, BETA_CAMPAIGN_DASHBOARD_CONFIG };

// Auto-run if script is executed directly
if (typeof window === "undefined" && require.main === module) {
  createBetaCampaignDashboard().catch(console.error);
}
