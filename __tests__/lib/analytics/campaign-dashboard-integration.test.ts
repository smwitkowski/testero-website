import {
  createCampaignDashboard,
  createCampaignInsights,
  getCampaignInsights,
  updateCampaignDashboard,
  CampaignDashboardConfig,
  CampaignInsightConfig,
} from "@/lib/analytics/campaign-dashboard-integration";

describe("Campaign Dashboard Integration", () => {
  let mockPostHogMCP: {
    "insight-create-from-query": jest.Mock;
    "dashboard-create": jest.Mock;
    "dashboard-get": jest.Mock;
    "add-insight-to-dashboard": jest.Mock;
    "get-sql-insight": jest.Mock;
  };

  beforeEach(() => {
    // Mock PostHog MCP functions
    mockPostHogMCP = {
      "insight-create-from-query": jest.fn(),
      "dashboard-create": jest.fn(),
      "dashboard-get": jest.fn(),
      "add-insight-to-dashboard": jest.fn(),
      "get-sql-insight": jest.fn(),
    };
  });

  describe("createCampaignDashboard", () => {
    it("should create a complete campaign dashboard with all insights", async () => {
      const dashboardConfig: CampaignDashboardConfig = {
        name: "Beta Campaign Dashboard",
        description: "Comprehensive tracking for beta email campaign performance",
        campaignId: "beta_75_test",
        insightConfigs: [
          {
            name: "Email Funnel Conversion",
            description: "Email campaign funnel from send to diagnostic completion",
            query: `
              SELECT 
                count() as total_emails,
                countIf(event = 'email_campaign_landing') as landed,
                countIf(event = 'diagnostic_started') as started_diagnostic,
                countIf(event = 'diagnostic_completed') as completed_diagnostic
              FROM events 
              WHERE properties.campaign_id = 'beta_75_test'
              AND timestamp >= now() - interval 30 day
            `,
          },
          {
            name: "A/B Variant Performance",
            description: "Conversion rates by A/B test variant",
            query: `
              SELECT 
                properties.variant as variant,
                count() as users,
                countIf(event = 'diagnostic_completed') as conversions,
                (conversions / users) * 100 as conversion_rate
              FROM events 
              WHERE properties.campaign_id = 'beta_75_test'
              AND properties.variant IS NOT NULL
              GROUP BY variant
            `,
          },
          {
            name: "Daily Campaign Performance",
            description: "Campaign metrics tracked over time",
            query: `
              SELECT 
                toDate(timestamp) as date,
                countIf(event = 'email_campaign_landing') as daily_landings,
                countIf(event = 'diagnostic_started') as daily_starts,
                countIf(event = 'diagnostic_completed') as daily_completions
              FROM events 
              WHERE properties.campaign_id = 'beta_75_test'
              GROUP BY date
              ORDER BY date DESC
            `,
          },
        ],
      };

      // Mock successful dashboard creation
      mockPostHogMCP["dashboard-create"].mockResolvedValue({
        id: "dashboard_123",
        name: "Beta Campaign Dashboard",
        url: "https://app.posthog.com/dashboard/dashboard_123",
      });

      // Mock successful insight creation
      mockPostHogMCP["insight-create-from-query"].mockResolvedValue({
        id: "insight_123",
        name: "Email Funnel Conversion",
        url: "https://app.posthog.com/insights/insight_123",
      });

      const result = await createCampaignDashboard(mockPostHogMCP, dashboardConfig);

      expect(result).toEqual({
        dashboardId: "dashboard_123",
        dashboardUrl: "https://app.posthog.com/dashboard/dashboard_123",
        insights: [
          {
            id: "insight_123",
            name: "Email Funnel Conversion",
            url: "https://app.posthog.com/insights/insight_123",
          },
          {
            id: "insight_123",
            name: "Email Funnel Conversion",
            url: "https://app.posthog.com/insights/insight_123",
          },
          {
            id: "insight_123",
            name: "Email Funnel Conversion",
            url: "https://app.posthog.com/insights/insight_123",
          },
        ],
      });

      // Should create dashboard
      expect(mockPostHogMCP["dashboard-create"]).toHaveBeenCalledWith({
        data: {
          name: "Beta Campaign Dashboard",
          description: "Comprehensive tracking for beta email campaign performance",
          pinned: true,
          tags: ["campaign", "beta", "email"],
        },
      });

      // Should create insights for each query
      expect(mockPostHogMCP["insight-create-from-query"]).toHaveBeenCalledTimes(3);
      expect(mockPostHogMCP["add-insight-to-dashboard"]).toHaveBeenCalledTimes(3);
    });

    it("should handle dashboard creation errors gracefully", async () => {
      const dashboardConfig: CampaignDashboardConfig = {
        name: "Test Dashboard",
        campaignId: "test_campaign",
        insightConfigs: [],
      };

      mockPostHogMCP["dashboard-create"].mockRejectedValue(new Error("Dashboard creation failed"));

      await expect(createCampaignDashboard(mockPostHogMCP, dashboardConfig)).rejects.toThrow(
        "Dashboard creation failed"
      );
    });
  });

  describe("createCampaignInsights", () => {
    it("should create individual insights with proper HogQL queries", async () => {
      const insightConfig: CampaignInsightConfig = {
        name: "Campaign Landing Events",
        description: "Track email campaign landing page visits",
        query: `
          SELECT 
            toDate(timestamp) as date,
            count() as landing_count
          FROM events 
          WHERE event = 'email_campaign_landing'
          AND properties.campaign_id = 'beta_75_test'
          GROUP BY date
        `,
      };

      mockPostHogMCP["insight-create-from-query"].mockResolvedValue({
        id: "insight_456",
        name: "Campaign Landing Events",
        short_id: "abc123",
      });

      const result = await createCampaignInsights(mockPostHogMCP, insightConfig);

      expect(result).toEqual({
        id: "insight_456",
        name: "Campaign Landing Events",
        short_id: "abc123",
      });

      expect(mockPostHogMCP["insight-create-from-query"]).toHaveBeenCalledWith({
        data: {
          name: "Campaign Landing Events",
          description: "Track email campaign landing page visits",
          query: {
            kind: "DataVisualizationNode",
            source: {
              kind: "HogQLQuery",
              query: expect.stringContaining("email_campaign_landing"),
              filters: {
                dateRange: {
                  date_from: "-30d",
                  date_to: "now",
                },
              },
            },
          },
          saved: true,
          favorited: false,
          tags: ["campaign"],
        },
      });
    });

    it("should create insights with custom date ranges", async () => {
      mockPostHogMCP["insight-create-from-query"].mockResolvedValue({
        id: "insight_custom_789",
        name: "Weekly Campaign Performance",
      });

      const insightConfig: CampaignInsightConfig = {
        name: "Weekly Campaign Performance",
        query: "SELECT count() as events FROM events",
        dateRange: {
          date_from: "-7d",
          date_to: "-1d",
        },
      };

      await createCampaignInsights(mockPostHogMCP, insightConfig);

      expect(mockPostHogMCP["insight-create-from-query"]).toHaveBeenCalledWith({
        data: expect.objectContaining({
          query: {
            kind: "DataVisualizationNode",
            source: {
              kind: "HogQLQuery",
              query: "SELECT count() as events FROM events",
              filters: {
                dateRange: {
                  date_from: "-7d",
                  date_to: "-1d",
                },
              },
            },
          },
        }),
      });
    });
  });

  describe("getCampaignInsights", () => {
    it("should retrieve campaign data using natural language queries", async () => {
      const mockQueryResult = {
        query: `
          SELECT 
            count() as total_events,
            countIf(event = 'email_campaign_landing') as landings
          FROM events 
          WHERE properties.campaign_id = 'beta_75_test'
        `,
        results: [{ total_events: 150, landings: 85 }],
      };

      mockPostHogMCP["get-sql-insight"].mockResolvedValue(mockQueryResult);

      const result = await getCampaignInsights(
        mockPostHogMCP,
        "Show me total events and landings for campaign beta_75_test"
      );

      expect(result).toEqual({
        query: expect.stringContaining("campaign_id = 'beta_75_test'"),
        results: [{ total_events: 150, landings: 85 }],
      });

      expect(mockPostHogMCP["get-sql-insight"]).toHaveBeenCalledWith({
        query: "Show me total events and landings for campaign beta_75_test",
      });
    });

    it("should handle query errors gracefully", async () => {
      mockPostHogMCP["get-sql-insight"].mockRejectedValue(new Error("Query execution failed"));

      await expect(getCampaignInsights(mockPostHogMCP, "Invalid query")).rejects.toThrow(
        "Query execution failed"
      );
    });
  });

  describe("updateCampaignDashboard", () => {
    it("should update existing dashboard with new insights", async () => {
      const newInsight: CampaignInsightConfig = {
        name: "Real-time Conversions",
        description: "Live conversion tracking",
        query: "SELECT count() as conversions FROM events WHERE event = 'diagnostic_completed'",
      };

      mockPostHogMCP["dashboard-get"].mockResolvedValue({
        id: "dashboard_789",
        name: "Beta Campaign Dashboard",
        insights: [{ id: "existing_insight_1", name: "Existing Insight" }],
      });

      mockPostHogMCP["insight-create-from-query"].mockResolvedValue({
        id: "new_insight_123",
        name: "Real-time Conversions",
      });

      const result = await updateCampaignDashboard(mockPostHogMCP, "dashboard_789", newInsight);

      expect(result).toEqual({
        dashboardId: "dashboard_789",
        newInsightId: "new_insight_123",
        totalInsights: 2,
      });

      expect(mockPostHogMCP["insight-create-from-query"]).toHaveBeenCalledTimes(1);
      expect(mockPostHogMCP["add-insight-to-dashboard"]).toHaveBeenCalledWith({
        data: {
          dashboardId: "dashboard_789",
          insightId: "new_insight_123",
        },
      });
    });

    it("should handle dashboard update errors", async () => {
      mockPostHogMCP["dashboard-get"].mockRejectedValue(new Error("Dashboard not found"));

      await expect(
        updateCampaignDashboard(mockPostHogMCP, "invalid_id", {
          name: "Test",
          query: "SELECT 1",
        })
      ).rejects.toThrow("Dashboard not found");
    });
  });

  describe("Campaign Metrics Integration", () => {
    it("should generate insights that match our campaign metrics calculations", async () => {
      const conversionRateQuery = `
        SELECT 
          countIf(event = 'email_campaign_landing') as emails_clicked,
          countIf(event = 'diagnostic_started') as diagnostic_starts,
          countIf(event = 'diagnostic_completed') as diagnostic_completions,
          (diagnostic_completions / emails_clicked) * 100 as conversion_rate
        FROM events 
        WHERE properties.campaign_id = 'beta_75_test'
        AND timestamp >= now() - interval 7 days
      `;

      const insightConfig: CampaignInsightConfig = {
        name: "Email to Diagnostic Conversion Rate",
        description: "Conversion rate from email click to diagnostic completion",
        query: conversionRateQuery,
      };

      mockPostHogMCP["insight-create-from-query"].mockResolvedValue({
        id: "insight_metrics_123",
        name: "Email to Diagnostic Conversion Rate",
      });

      await createCampaignInsights(mockPostHogMCP, insightConfig);

      const capturedQuery = mockPostHogMCP["insight-create-from-query"].mock.calls[0][0];
      expect(capturedQuery.data.query.source.query).toContain("conversion_rate");
      expect(capturedQuery.data.query.source.query).toContain("beta_75_test");
      expect(capturedQuery.data.query.source.query).toContain("email_campaign_landing");
    });
  });
});
