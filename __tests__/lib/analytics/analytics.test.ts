import {
  trackEvent,
  identifyUser,
  trackConversion,
  trackError,
  trackEngagement,
  ANALYTICS_EVENTS,
  USER_PROPERTIES,
} from "@/lib/analytics/analytics";
import { getServerPostHog, resetServerPostHog } from "@/lib/analytics/server-analytics";
import { PostHog } from "posthog-node";

// Mock posthog-node
jest.mock("posthog-node");

describe("Analytics Utilities", () => {
  let mockClientPostHog: any;
  let mockServerPostHog: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock client-side PostHog (from usePostHog hook)
    mockClientPostHog = {
      capture: jest.fn(),
      identify: jest.fn(),
    };

    // Mock server-side PostHog
    mockServerPostHog = {
      capture: jest.fn(),
      identify: jest.fn(),
      shutdown: jest.fn(),
    };

    // Mock the PostHog constructor
    (PostHog as jest.Mock).mockImplementation(() => mockServerPostHog);
  });

  describe("trackEvent", () => {
    it("should track events with client-side PostHog", () => {
      const properties = { test: "value" };

      trackEvent(mockClientPostHog, ANALYTICS_EVENTS.DASHBOARD_VIEWED, properties);

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.DASHBOARD_VIEWED,
        properties
      );
    });

    it("should track events with server-side PostHog", () => {
      const properties = { test: "value" };
      const distinctId = "user-123";

      trackEvent(mockServerPostHog, ANALYTICS_EVENTS.DASHBOARD_VIEWED, properties, distinctId);

      expect(mockServerPostHog.capture).toHaveBeenCalledWith({
        distinctId,
        event: ANALYTICS_EVENTS.DASHBOARD_VIEWED,
        properties,
      });
    });

    it("should handle null PostHog instance gracefully", () => {
      expect(() => {
        trackEvent(null, ANALYTICS_EVENTS.DASHBOARD_VIEWED, {});
      }).not.toThrow();
    });

    it("should work without properties", () => {
      trackEvent(mockClientPostHog, ANALYTICS_EVENTS.DASHBOARD_VIEWED);

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.DASHBOARD_VIEWED,
        undefined
      );
    });
  });

  describe("identifyUser", () => {
    it("should identify user with client-side PostHog", () => {
      const userId = "user-123";
      const properties = {
        email: "test@example.com",
        is_early_access: true,
      };

      identifyUser(mockClientPostHog, userId, properties);

      expect(mockClientPostHog.identify).toHaveBeenCalledWith(userId, properties);
    });

    it("should identify user with server-side PostHog", () => {
      const userId = "user-123";
      const properties = {
        email: "test@example.com",
        plan_tier: "pro",
      };

      identifyUser(mockServerPostHog, userId, properties);

      expect(mockServerPostHog.identify).toHaveBeenCalledWith({
        distinctId: userId,
        properties,
      });
    });

    it("should handle null PostHog instance gracefully", () => {
      expect(() => {
        identifyUser(null, "user-123", {});
      }).not.toThrow();
    });
  });

  describe("trackConversion", () => {
    it("should track conversion with proper event structure", () => {
      const conversionType = "trial_to_paid";
      const value = 59.99;
      const properties = { plan: "pro" };

      trackConversion(mockClientPostHog, conversionType, value, properties);

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.TRIAL_TO_PAID_CONVERSION,
        {
          conversion_type: conversionType,
          conversion_value: value,
          ...properties,
        }
      );
    });

    it("should work without optional properties", () => {
      trackConversion(mockClientPostHog, "signup", 0);

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.TRIAL_TO_PAID_CONVERSION,
        {
          conversion_type: "signup",
          conversion_value: 0,
        }
      );
    });
  });

  describe("trackError", () => {
    it("should track errors with full details", () => {
      const error = new Error("Test error");
      const context = { page: "/dashboard" };
      const userId = "user-123";

      trackError(mockServerPostHog, error, context, userId);

      expect(mockServerPostHog.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: userId,
          event: "unhandled_error",
          properties: expect.objectContaining({
            error_message: "Test error",
            error_stack: expect.any(String),
            ...context,
          }),
        })
      );
    });

    it("should handle non-Error objects", () => {
      const errorString = "Something went wrong";

      trackError(mockClientPostHog, errorString, {});

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(
        "unhandled_error",
        expect.objectContaining({
          error_message: errorString,
          error_stack: undefined,
        })
      );
    });
  });

  describe("trackEngagement", () => {
    it("should track engagement metrics", () => {
      const engagementValue = 75;
      const properties = { page: "/practice" };

      trackEngagement(mockClientPostHog, "feature_interaction", engagementValue, properties);

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.FEATURE_USED, {
        engagement_type: "feature_interaction",
        engagement_value: engagementValue,
        ...properties,
      });
    });

    it("should work with server-side PostHog", () => {
      const userId = "user-123";

      trackEngagement(mockServerPostHog, "session_duration", 120, {}, userId);

      expect(mockServerPostHog.capture).toHaveBeenCalledWith({
        distinctId: userId,
        event: ANALYTICS_EVENTS.FEATURE_USED,
        properties: {
          engagement_type: "session_duration",
          engagement_value: 120,
        },
      });
    });
  });

  describe("getServerPostHog", () => {
    beforeEach(() => {
      resetServerPostHog();
    });

    it("should create and return a singleton PostHog instance", () => {
      const instance1 = getServerPostHog();
      const instance2 = getServerPostHog();

      expect(instance1).toBe(instance2);
      expect(PostHog).toHaveBeenCalledTimes(1);
    });

    it("should initialize with correct configuration", () => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "test-key";
      process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://test.posthog.com";

      getServerPostHog();

      expect(PostHog).toHaveBeenCalledWith("test-key", {
        host: "https://test.posthog.com",
      });
    });
  });

  describe("Constants", () => {
    it("should have all required event constants", () => {
      // Authentication events
      expect(ANALYTICS_EVENTS.USER_SESSION_STARTED).toBeDefined();
      expect(ANALYTICS_EVENTS.SIGNUP_SUCCESS).toBeDefined();

      // Dashboard events
      expect(ANALYTICS_EVENTS.DASHBOARD_VIEWED).toBeDefined();
      expect(ANALYTICS_EVENTS.DASHBOARD_LOADED).toBeDefined();

      // Diagnostic events
      expect(ANALYTICS_EVENTS.DIAGNOSTIC_STARTED).toBeDefined();
      expect(ANALYTICS_EVENTS.DIAGNOSTIC_COMPLETED).toBeDefined();

      // Beta onboarding events
      expect(ANALYTICS_EVENTS.INVITE_CLICKED).toBeDefined();

      // Billing events
      expect(ANALYTICS_EVENTS.SUBSCRIPTION_CREATED).toBeDefined();
      expect(ANALYTICS_EVENTS.PAYMENT_FAILED).toBeDefined();
    });

    it("should have all required user property constants", () => {
      expect(USER_PROPERTIES.USER_ID).toBe("user_id");
      expect(USER_PROPERTIES.EMAIL).toBe("email");
      expect(USER_PROPERTIES.PLAN_TIER).toBe("plan_tier");
      expect(USER_PROPERTIES.IS_EARLY_ACCESS).toBe("is_early_access");
    });
  });

  describe("Beta Variant Analytics", () => {
    it("should track INVITE_CLICKED event with beta_variant property", () => {
      const properties = {
        beta_variant: "A",
        source: "beta_welcome",
        cta_type: "start_diagnostic",
      };

      trackEvent(mockClientPostHog, ANALYTICS_EVENTS.INVITE_CLICKED, properties);

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.INVITE_CLICKED,
        properties
      );
    });

    it("should track DIAGNOSTIC_STARTED with beta_variant property", () => {
      const properties = {
        beta_variant: "B",
        exam_type: "PMLE",
        num_questions: 20,
      };

      trackEvent(mockClientPostHog, ANALYTICS_EVENTS.DIAGNOSTIC_STARTED, properties);

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.DIAGNOSTIC_STARTED,
        properties
      );
    });

    it("should track DIAGNOSTIC_COMPLETED with beta_variant property", () => {
      const properties = {
        beta_variant: "A",
        exam_type: "PMLE",
        score: 75,
        duration_minutes: 15,
      };

      trackEvent(mockClientPostHog, ANALYTICS_EVENTS.DIAGNOSTIC_COMPLETED, properties);

      expect(mockClientPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.DIAGNOSTIC_COMPLETED,
        properties
      );
    });

    it("should handle beta_variant property with server-side PostHog", () => {
      const properties = {
        beta_variant: "B",
        source: "beta_welcome",
      };
      const distinctId = "user-123";

      trackEvent(mockServerPostHog, ANALYTICS_EVENTS.INVITE_CLICKED, properties, distinctId);

      expect(mockServerPostHog.capture).toHaveBeenCalledWith({
        distinctId,
        event: ANALYTICS_EVENTS.INVITE_CLICKED,
        properties,
      });
    });
  });

  describe("Type Safety", () => {
    it("should accept any PostHog-like object without React hook imports", () => {
      const customPostHog = {
        capture: jest.fn(),
        identify: jest.fn(),
      };

      expect(() => {
        trackEvent(customPostHog, ANALYTICS_EVENTS.DASHBOARD_VIEWED, {});
        identifyUser(customPostHog, "user-123", {});
      }).not.toThrow();
    });

    it("should handle both client and server PostHog types", () => {
      // This test ensures our type system works without usePostHog import
      const clientLike = { capture: jest.fn(), identify: jest.fn() };
      const serverLike = { capture: jest.fn(), identify: jest.fn(), shutdown: jest.fn() };

      trackEvent(clientLike, ANALYTICS_EVENTS.DASHBOARD_VIEWED, {});
      trackEvent(serverLike, ANALYTICS_EVENTS.DASHBOARD_VIEWED, {}, "user-123");

      expect(clientLike.capture).toHaveBeenCalled();
      expect(serverLike.capture).toHaveBeenCalled();
    });
  });
});
