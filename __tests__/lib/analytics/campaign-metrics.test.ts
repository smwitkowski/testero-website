import {
  calculateCampaignFunnelMetrics,
  calculateVariantComparison,
  calculateConversionRates,
  aggregateCampaignData,
  CampaignMetricsData,
  FunnelMetrics,
  VariantComparison,
  ConversionRates,
} from "@/lib/analytics/campaign-metrics";

describe("Campaign Metrics Calculations", () => {
  describe("calculateCampaignFunnelMetrics", () => {
    it("should calculate funnel conversion rates correctly", () => {
      const data: CampaignMetricsData = {
        emails_sent: 75,
        emails_opened: 45,
        emails_clicked: 30,
        landing_page_views: 28,
        diagnostic_sessions_started: 22,
        diagnostic_sessions_completed: 18,
      };

      const metrics = calculateCampaignFunnelMetrics(data);

      expect(metrics).toEqual({
        open_rate: 60, // 45/75 * 100
        click_through_rate: 40, // 30/75 * 100
        click_to_landing_rate: 93.33, // 28/30 * 100
        landing_to_diagnostic_rate: 78.57, // 22/28 * 100
        diagnostic_completion_rate: 81.82, // 18/22 * 100
        overall_conversion_rate: 24, // 18/75 * 100
        total_dropoff: 76, // (75-18)/75 * 100 = 57/75 = 76%
        largest_dropoff_stage: "email_open", // 75-45 = 30 people (largest dropoff)
        largest_dropoff_amount: 30, // 75-45 = 30 people
      });
    });

    it("should handle edge cases with zero values", () => {
      const data: CampaignMetricsData = {
        emails_sent: 100,
        emails_opened: 0,
        emails_clicked: 0,
        landing_page_views: 0,
        diagnostic_sessions_started: 0,
        diagnostic_sessions_completed: 0,
      };

      const metrics = calculateCampaignFunnelMetrics(data);

      expect(metrics.open_rate).toBe(0);
      expect(metrics.click_through_rate).toBe(0);
      expect(metrics.overall_conversion_rate).toBe(0);
      expect(metrics.total_dropoff).toBe(100);
    });

    it("should handle division by zero scenarios", () => {
      const data: CampaignMetricsData = {
        emails_sent: 0,
        emails_opened: 0,
        emails_clicked: 0,
        landing_page_views: 0,
        diagnostic_sessions_started: 0,
        diagnostic_sessions_completed: 0,
      };

      const metrics = calculateCampaignFunnelMetrics(data);

      expect(metrics.open_rate).toBe(0);
      expect(metrics.click_through_rate).toBe(0);
      expect(metrics.overall_conversion_rate).toBe(0);
    });

    it("should round percentages to 2 decimal places", () => {
      const data: CampaignMetricsData = {
        emails_sent: 37, // Odd number to create decimal percentages
        emails_opened: 25,
        emails_clicked: 15,
        landing_page_views: 14,
        diagnostic_sessions_started: 11,
        diagnostic_sessions_completed: 8,
      };

      const metrics = calculateCampaignFunnelMetrics(data);

      expect(metrics.open_rate).toBe(67.57); // 25/37 * 100
      expect(metrics.click_through_rate).toBe(40.54); // 15/37 * 100
      expect(metrics.overall_conversion_rate).toBe(21.62); // 8/37 * 100
    });
  });

  describe("calculateVariantComparison", () => {
    it("should compare A/B test variants correctly", () => {
      const variantA = {
        emails_sent: 38,
        emails_opened: 23,
        emails_clicked: 15,
        landing_page_views: 14,
        diagnostic_sessions_started: 11,
        diagnostic_sessions_completed: 9,
      };

      const variantB = {
        emails_sent: 37,
        emails_opened: 22,
        emails_clicked: 14,
        landing_page_views: 13,
        diagnostic_sessions_started: 10,
        diagnostic_sessions_completed: 7,
      };

      const comparison = calculateVariantComparison(variantA, variantB);

      expect(comparison.variant_a_conversion_rate).toBe(23.68); // 9/38 * 100
      expect(comparison.variant_b_conversion_rate).toBe(18.92); // 7/37 * 100
      expect(comparison.conversion_rate_lift).toBe(4.76); // 23.68 - 18.92
      expect(comparison.relative_lift_percentage).toBe(25.16); // (4.76/18.92) * 100
      expect(comparison.winner).toBe("A");
      expect(comparison.statistical_significance).toBe(false); // Small sample size
    });

    it("should identify variant B as winner when it performs better", () => {
      const variantA = {
        emails_sent: 40,
        diagnostic_sessions_completed: 8, // 20% conversion
      };

      const variantB = {
        emails_sent: 35,
        diagnostic_sessions_completed: 10, // ~28.6% conversion
      };

      const comparison = calculateVariantComparison(variantA, variantB);

      expect(comparison.winner).toBe("B");
      expect(comparison.relative_lift_percentage).toBeGreaterThan(40);
    });

    it("should handle tie scenarios", () => {
      const variantA = {
        emails_sent: 40,
        diagnostic_sessions_completed: 10, // 25% conversion
      };

      const variantB = {
        emails_sent: 40,
        diagnostic_sessions_completed: 10, // 25% conversion
      };

      const comparison = calculateVariantComparison(variantA, variantB);

      expect(comparison.winner).toBe("tie");
      expect(comparison.conversion_rate_lift).toBe(0);
      expect(comparison.relative_lift_percentage).toBe(0);
    });

    it("should calculate statistical significance for large samples", () => {
      // Simulate larger sample sizes that could reach statistical significance
      const variantA = {
        emails_sent: 1000,
        diagnostic_sessions_completed: 250, // 25% conversion
      };

      const variantB = {
        emails_sent: 1000,
        diagnostic_sessions_completed: 300, // 30% conversion
      };

      const comparison = calculateVariantComparison(variantA, variantB);

      expect(comparison.statistical_significance).toBe(true);
      expect(comparison.confidence_level).toBeGreaterThan(95);
    });
  });

  describe("calculateConversionRates", () => {
    it("should calculate time-based conversion rates", () => {
      const timeSeriesData = [
        { timestamp: Date.now() - 3600000, emails_sent: 25, completed: 5 }, // 1 hour ago
        { timestamp: Date.now() - 7200000, emails_sent: 25, completed: 6 }, // 2 hours ago
        { timestamp: Date.now() - 10800000, emails_sent: 25, completed: 7 }, // 3 hours ago
      ];

      const rates = calculateConversionRates(timeSeriesData);

      expect(rates.hourly_rates).toHaveLength(3);
      expect(rates.current_rate).toBe(20); // 5/25 * 100 (most recent)
      expect(rates.average_rate).toBe(24); // (5+6+7)/(25+25+25) * 100
      expect(rates.trend).toBe("declining"); // 20% < 24%
    });

    it("should identify improving trends", () => {
      const timeSeriesData = [
        { timestamp: Date.now() - 3600000, emails_sent: 25, completed: 8 }, // 32% (recent)
        { timestamp: Date.now() - 7200000, emails_sent: 25, completed: 6 }, // 24%
        { timestamp: Date.now() - 10800000, emails_sent: 25, completed: 5 }, // 20%
      ];

      const rates = calculateConversionRates(timeSeriesData);

      expect(rates.trend).toBe("improving");
      expect(rates.current_rate).toBeGreaterThan(rates.average_rate);
    });

    it("should handle stable trends", () => {
      const timeSeriesData = [
        { timestamp: Date.now() - 3600000, emails_sent: 20, completed: 5 }, // 25%
        { timestamp: Date.now() - 7200000, emails_sent: 20, completed: 5 }, // 25%
        { timestamp: Date.now() - 10800000, emails_sent: 20, completed: 5 }, // 25%
      ];

      const rates = calculateConversionRates(timeSeriesData);

      expect(rates.trend).toBe("stable");
      expect(rates.current_rate).toBe(rates.average_rate);
    });
  });

  describe("aggregateCampaignData", () => {
    it("should aggregate data from multiple sources", () => {
      // Simulate data from different sources
      const loopsData = {
        emails_sent: 75,
        emails_opened: 45,
        emails_clicked: 30,
        bounce_rate: 5.33,
        unsubscribe_rate: 1.33,
      };

      const posthogEvents = [
        { event: "email_campaign_landing", properties: { campaign_id: "beta_75_test" } },
        { event: "email_campaign_landing", properties: { campaign_id: "beta_75_test" } },
        { event: "diagnostic_started", properties: { campaign_id: "beta_75_test" } },
        { event: "diagnostic_completed", properties: { campaign_id: "beta_75_test" } },
      ];

      const aggregated = aggregateCampaignData(loopsData, posthogEvents);

      expect(aggregated.emails_sent).toBe(75);
      expect(aggregated.emails_opened).toBe(45);
      expect(aggregated.emails_clicked).toBe(30);
      expect(aggregated.landing_page_views).toBe(2); // Count of landing events
      expect(aggregated.diagnostic_sessions_started).toBe(1);
      expect(aggregated.diagnostic_sessions_completed).toBe(1);
      expect(aggregated.bounce_rate).toBe(5.33);
    });

    it("should handle missing data gracefully", () => {
      const loopsData = {
        emails_sent: 50,
        // Missing other fields
      };

      const posthogEvents: any[] = []; // No events

      const aggregated = aggregateCampaignData(loopsData, posthogEvents);

      expect(aggregated.emails_sent).toBe(50);
      expect(aggregated.emails_opened).toBe(0);
      expect(aggregated.landing_page_views).toBe(0);
      expect(aggregated.diagnostic_sessions_started).toBe(0);
    });

    it("should filter events by campaign_id when provided", () => {
      const loopsData = { emails_sent: 100 };

      const posthogEvents = [
        { event: "diagnostic_started", properties: { campaign_id: "beta_75_test" } },
        { event: "diagnostic_started", properties: { campaign_id: "other_campaign" } },
        { event: "diagnostic_completed", properties: { campaign_id: "beta_75_test" } },
      ];

      const aggregated = aggregateCampaignData(loopsData, posthogEvents, "beta_75_test");

      expect(aggregated.diagnostic_sessions_started).toBe(1); // Only beta_75_test
      expect(aggregated.diagnostic_sessions_completed).toBe(1); // Only beta_75_test
    });
  });

  describe("End-to-End Campaign Analysis", () => {
    it("should provide complete campaign analysis", () => {
      // Simulate realistic beta campaign data
      const campaignData: CampaignMetricsData = {
        emails_sent: 75,
        emails_opened: 48, // 64% open rate
        emails_clicked: 32, // 42.67% CTR
        landing_page_views: 30, // 2 drop off between click and landing
        diagnostic_sessions_started: 25, // 83.33% landing to diagnostic
        diagnostic_sessions_completed: 20, // 80% completion rate
      };

      const variantA = {
        emails_sent: 38,
        diagnostic_sessions_completed: 11, // 28.95% conversion
      };

      const variantB = {
        emails_sent: 37,
        diagnostic_sessions_completed: 9, // 24.32% conversion
      };

      const funnelMetrics = calculateCampaignFunnelMetrics(campaignData);
      const variantComparison = calculateVariantComparison(variantA, variantB);

      // Overall campaign performance
      expect(funnelMetrics.open_rate).toBeGreaterThan(60);
      expect(funnelMetrics.click_through_rate).toBeGreaterThan(40);
      expect(funnelMetrics.overall_conversion_rate).toBeGreaterThan(25);

      // A/B test results
      expect(variantComparison.winner).toBe("A");
      expect(variantComparison.relative_lift_percentage).toBeGreaterThan(15);
    });
  });
});
