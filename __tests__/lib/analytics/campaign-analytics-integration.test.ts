import {
  trackCampaignLanding,
  trackDiagnosticStartWithCampaign,
  trackDiagnosticCompleteWithCampaign,
  setCampaignAttributionFromURL,
  createEnhancedTrackEvent,
} from "@/lib/analytics/campaign-analytics-integration";
import { ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { CampaignParams } from "@/lib/analytics/campaign-attribution";

describe("Campaign Analytics Integration", () => {
  let mockPostHog: {
    capture: jest.Mock;
    identify: jest.Mock;
  };

  let mockSessionStorage: { [key: string]: string } = {};

  beforeEach(() => {
    // Mock PostHog
    mockPostHog = {
      capture: jest.fn(),
      identify: jest.fn(),
    };

    // Mock sessionStorage
    mockSessionStorage = {};
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: jest.fn((key: string) => mockSessionStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
      },
      writable: true,
    });

    // Mock window.location
    Object.defineProperty(window, "location", {
      value: {
        href: "https://testero.com/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A",
        pathname: "/beta/welcome",
      },
      writable: true,
    });
  });

  describe("trackCampaignLanding", () => {
    it("should track email campaign landing with attribution", () => {
      const campaignParams: CampaignParams = {
        utm_source: "loops",
        utm_campaign: "beta_launch_2025",
        campaign_id: "beta_75_test",
        variant: "A",
      };

      trackCampaignLanding(mockPostHog, campaignParams, "user_123");

      expect(mockPostHog.capture).toHaveBeenCalledWith({
        distinctId: "user_123",
        event: ANALYTICS_EVENTS.EMAIL_CAMPAIGN_LANDING,
        properties: {
          utm_source: "loops",
          utm_campaign: "beta_launch_2025",
          campaign_id: "beta_75_test",
          variant: "A",
          landing_page: "/beta/welcome",
          timestamp: expect.any(Number),
        },
      });
    });

    it("should handle client-side PostHog tracking", () => {
      const clientPostHog = {
        capture: jest.fn(),
      };

      const campaignParams: CampaignParams = {
        campaign_id: "beta_75_test",
        variant: "B",
      };

      trackCampaignLanding(clientPostHog, campaignParams);

      expect(clientPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.EMAIL_CAMPAIGN_LANDING,
        expect.objectContaining({
          campaign_id: "beta_75_test",
          variant: "B",
        })
      );
    });

    it("should not track if PostHog client is null", () => {
      const campaignParams: CampaignParams = {
        campaign_id: "beta_75_test",
      };

      // Should not throw error
      expect(() => {
        trackCampaignLanding(null, campaignParams);
      }).not.toThrow();
    });
  });

  describe("trackDiagnosticStartWithCampaign", () => {
    it("should enhance diagnostic start event with campaign attribution", () => {
      // Store campaign attribution first
      const attribution: CampaignParams = {
        campaign_id: "beta_75_test",
        variant: "A",
        utm_source: "loops",
      };
      mockSessionStorage["testero_campaign_attribution"] = JSON.stringify(attribution);

      const baseEvent = {
        sessionId: "session_123",
        examType: "PMLE",
        questionCount: 25,
      };

      trackDiagnosticStartWithCampaign(mockPostHog, baseEvent, "user_123");

      expect(mockPostHog.capture).toHaveBeenCalledWith({
        distinctId: "user_123",
        event: ANALYTICS_EVENTS.DIAGNOSTIC_STARTED,
        properties: {
          sessionId: "session_123",
          examType: "PMLE",
          questionCount: 25,
          campaign_id: "beta_75_test",
          variant: "A",
          utm_source: "loops",
        },
      });
    });

    it("should work without stored campaign attribution", () => {
      const baseEvent = {
        sessionId: "session_123",
        examType: "PMLE",
      };

      trackDiagnosticStartWithCampaign(mockPostHog, baseEvent, "user_123");

      expect(mockPostHog.capture).toHaveBeenCalledWith({
        distinctId: "user_123",
        event: ANALYTICS_EVENTS.DIAGNOSTIC_STARTED,
        properties: {
          sessionId: "session_123",
          examType: "PMLE",
        },
      });
    });
  });

  describe("trackDiagnosticCompleteWithCampaign", () => {
    it("should enhance diagnostic completion with campaign attribution", () => {
      const attribution: CampaignParams = {
        campaign_id: "beta_75_test",
        variant: "B",
      };
      mockSessionStorage["testero_campaign_attribution"] = JSON.stringify(attribution);

      const completionData = {
        sessionId: "session_123",
        totalQuestions: 25,
        correctAnswers: 18,
        completionTime: 1200000, // 20 minutes
      };

      trackDiagnosticCompleteWithCampaign(mockPostHog, completionData, "user_123");

      expect(mockPostHog.capture).toHaveBeenCalledWith({
        distinctId: "user_123",
        event: ANALYTICS_EVENTS.DIAGNOSTIC_COMPLETED,
        properties: {
          sessionId: "session_123",
          totalQuestions: 25,
          correctAnswers: 18,
          completionTime: 1200000,
          campaign_id: "beta_75_test",
          variant: "B",
        },
      });
    });
  });

  describe("setCampaignAttributionFromURL", () => {
    it("should extract and store campaign attribution from current URL", () => {
      window.location.href =
        "https://testero.com/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A&email=user%40example.com";

      const attribution = setCampaignAttributionFromURL();

      expect(attribution).toEqual({
        utm_source: "loops",
        campaign_id: "beta_75_test",
        variant: "A",
        email: "user@example.com",
        utm_campaign: undefined,
      });

      // Should be stored in sessionStorage
      expect(mockSessionStorage["testero_campaign_attribution"]).toBeDefined();
      const stored = JSON.parse(mockSessionStorage["testero_campaign_attribution"]);
      expect(stored).toEqual(attribution);
    });

    it("should track campaign attribution event", () => {
      window.location.href = "https://testero.com/beta/welcome?campaign_id=beta_75_test&variant=A";

      setCampaignAttributionFromURL(mockPostHog, "user_123");

      expect(mockPostHog.capture).toHaveBeenCalledWith({
        distinctId: "user_123",
        event: ANALYTICS_EVENTS.CAMPAIGN_ATTRIBUTION_SET,
        properties: {
          campaign_id: "beta_75_test",
          variant: "A",
          utm_source: undefined,
          utm_campaign: undefined,
          email: undefined,
          source_url: expect.stringContaining("campaign_id=beta_75_test"),
        },
      });
    });

    it("should return null when no campaign parameters in URL", () => {
      window.location.href = "https://testero.com/beta/welcome";

      const attribution = setCampaignAttributionFromURL();

      expect(attribution).toBeNull();
      expect(mockSessionStorage["testero_campaign_attribution"]).toBeUndefined();
    });
  });

  describe("createEnhancedTrackEvent", () => {
    it("should create enhanced tracking function with automatic campaign attribution", () => {
      const attribution: CampaignParams = {
        campaign_id: "beta_75_test",
        variant: "A",
      };
      mockSessionStorage["testero_campaign_attribution"] = JSON.stringify(attribution);

      const enhancedTracker = createEnhancedTrackEvent(mockPostHog);

      enhancedTracker(
        ANALYTICS_EVENTS.DIAGNOSTIC_QUESTION_ANSWERED,
        {
          questionId: "q_123",
          selectedAnswer: "A",
        },
        "user_123"
      );

      expect(mockPostHog.capture).toHaveBeenCalledWith({
        distinctId: "user_123",
        event: ANALYTICS_EVENTS.DIAGNOSTIC_QUESTION_ANSWERED,
        properties: {
          questionId: "q_123",
          selectedAnswer: "A",
          campaign_id: "beta_75_test",
          variant: "A",
        },
      });
    });

    it("should work with client-side PostHog", () => {
      const clientPostHog = {
        capture: jest.fn(),
      };

      const attribution: CampaignParams = {
        campaign_id: "beta_75_test",
      };
      mockSessionStorage["testero_campaign_attribution"] = JSON.stringify(attribution);

      const enhancedTracker = createEnhancedTrackEvent(clientPostHog);

      enhancedTracker(ANALYTICS_EVENTS.PRICING_PAGE_VIEWED, { plan: "premium" });

      expect(clientPostHog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.PRICING_PAGE_VIEWED, {
        plan: "premium",
        campaign_id: "beta_75_test",
      });
    });
  });

  describe("Campaign Attribution Lifecycle", () => {
    it("should maintain attribution throughout user journey", () => {
      // 1. User lands from email campaign
      window.location.href =
        "https://testero.com/beta/welcome?utm_source=loops&campaign_id=beta_75_test&variant=A";

      const landingAttribution = setCampaignAttributionFromURL(mockPostHog, "user_123");
      expect(landingAttribution?.campaign_id).toBe("beta_75_test");

      // 2. User starts diagnostic
      const diagnosticStartEvent = {
        sessionId: "session_123",
        examType: "PMLE",
      };

      trackDiagnosticStartWithCampaign(mockPostHog, diagnosticStartEvent, "user_123");

      // 3. User completes diagnostic
      const completionEvent = {
        sessionId: "session_123",
        totalQuestions: 25,
        score: 72,
      };

      trackDiagnosticCompleteWithCampaign(mockPostHog, completionEvent, "user_123");

      // All events should include campaign attribution
      expect(mockPostHog.capture).toHaveBeenCalledTimes(3); // attribution_set, diagnostic_started, diagnostic_completed

      mockPostHog.capture.mock.calls.forEach((call) => {
        if (call[0].event !== ANALYTICS_EVENTS.CAMPAIGN_ATTRIBUTION_SET) {
          expect(call[0].properties).toMatchObject({
            campaign_id: "beta_75_test",
            variant: "A",
          });
        }
      });
    });
  });
});
