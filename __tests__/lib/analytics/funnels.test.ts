import {
  trackFunnelStep,
  trackFunnelComplete,
  trackFunnelAbandonment,
  trackExitIntent,
  trackActivationFunnel,
  trackPurchaseFunnel,
  trackRetentionFunnel,
  calculateFunnelDropoff,
  getFunnelMetrics,
  FUNNEL_STEPS,
} from "@/lib/analytics/funnels";
import { trackEvent } from "@/lib/analytics/analytics";

// Mock the analytics module
jest.mock("@/lib/analytics/analytics");

// Mock sessionStorage
const mockSessionStorage: {
  storage: Record<string, string>;
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  clear: jest.Mock;
} = {
  storage: {} as Record<string, string>,
  getItem: jest.fn((key: string): string | null => mockSessionStorage.storage[key] || null),
  setItem: jest.fn((key: string, value: string): void => {
    mockSessionStorage.storage[key] = value;
  }),
  removeItem: jest.fn((key: string): void => {
    delete mockSessionStorage.storage[key];
  }),
  clear: jest.fn((): void => {
    mockSessionStorage.storage = {};
  }),
};

Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
});

describe("Funnel Tracking", () => {
  let mockPostHog: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.clear();

    mockPostHog = {
      capture: jest.fn(),
      identify: jest.fn(),
    };

    // Reset mocked trackEvent
    (trackEvent as jest.Mock).mockClear();
  });

  describe("trackFunnelStep", () => {
    it("should initialize a new funnel on first step", () => {
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING, {
        source: "homepage",
      });

      // Check sessionStorage was updated
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      const savedState = JSON.parse(mockSessionStorage.setItem.mock.calls[0][1]);
      expect(savedState.ACTIVATION).toBeDefined();
      expect(savedState.ACTIVATION.currentStep).toBe(FUNNEL_STEPS.ACTIVATION.LANDING);
      expect(savedState.ACTIVATION.startTime).toBeDefined();
    });

    it("should track funnel entry event on first step", () => {
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);

      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        expect.any(String), // FEATURE_DISCOVERED event
        expect.objectContaining({
          funnel_name: "ACTIVATION",
          entry_step: FUNNEL_STEPS.ACTIVATION.LANDING,
          discovery_type: "funnel_start",
        }),
        undefined
      );
    });

    it("should track progression to next step", () => {
      // Initialize funnel
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);
      jest.clearAllMocks();

      // Progress to next step
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.SIGNUP_START);

      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        expect.any(String), // FEATURE_USED event
        expect.objectContaining({
          funnel_name: "ACTIVATION",
          funnel_step: FUNNEL_STEPS.ACTIVATION.SIGNUP_START,
          previous_step: FUNNEL_STEPS.ACTIVATION.LANDING,
          step_number: 2,
        }),
        undefined
      );
    });

    it("should calculate time between steps", () => {
      const mockNow = Date.now();
      jest
        .spyOn(Date, "now")
        .mockReturnValueOnce(mockNow) // First step
        .mockReturnValueOnce(mockNow + 5000); // Second step, 5 seconds later

      trackFunnelStep(mockPostHog, "PURCHASE", FUNNEL_STEPS.PURCHASE.PRICING_VIEW);
      trackFunnelStep(mockPostHog, "PURCHASE", FUNNEL_STEPS.PURCHASE.PLAN_SELECT);

      expect(trackEvent).toHaveBeenLastCalledWith(
        mockPostHog,
        expect.any(String),
        expect.objectContaining({
          time_since_last_step: 5000,
          total_funnel_time: 5000,
        }),
        undefined
      );
    });

    it("should handle null PostHog instance gracefully", () => {
      expect(() => {
        trackFunnelStep(null, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);
      }).not.toThrow();
    });
  });

  describe("trackFunnelComplete", () => {
    it("should track funnel completion with metrics", () => {
      const mockNow = Date.now();
      jest
        .spyOn(Date, "now")
        .mockReturnValueOnce(mockNow) // First step
        .mockReturnValueOnce(mockNow + 5000) // Second step
        .mockReturnValueOnce(mockNow + 10000); // Completion

      // Complete a funnel
      trackFunnelStep(mockPostHog, "PURCHASE", FUNNEL_STEPS.PURCHASE.PRICING_VIEW);
      trackFunnelStep(mockPostHog, "PURCHASE", FUNNEL_STEPS.PURCHASE.CHECKOUT_START);

      trackFunnelComplete(mockPostHog, "PURCHASE", { order_value: 59.99 });

      expect(trackEvent).toHaveBeenLastCalledWith(
        mockPostHog,
        expect.any(String), // TRIAL_TO_PAID_CONVERSION event
        expect.objectContaining({
          funnel_name: "PURCHASE",
          total_time: 10000,
          step_count: 2,
          completion_rate: 100,
          order_value: 59.99,
        }),
        undefined
      );
    });

    it("should clear funnel from state after completion", () => {
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);
      trackFunnelComplete(mockPostHog, "ACTIVATION");

      const state = JSON.parse(mockSessionStorage.storage["testero_funnel_state"] || "{}");
      expect(state.ACTIVATION).toBeUndefined();
    });

    it("should handle completion of non-existent funnel", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      trackFunnelComplete(mockPostHog, "ACTIVATION");

      expect(consoleSpy).toHaveBeenCalledWith("Funnel ACTIVATION not found in state");
      consoleSpy.mockRestore();
    });
  });

  describe("trackFunnelAbandonment", () => {
    it("should track abandonment with reason", () => {
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.SIGNUP_START);

      trackFunnelAbandonment(mockPostHog, "ACTIVATION", "form_error", {
        error: "Email already exists",
      });

      expect(trackEvent).toHaveBeenLastCalledWith(
        mockPostHog,
        expect.any(String), // DIAGNOSTIC_ABANDONED event
        expect.objectContaining({
          funnel_name: "ACTIVATION",
          abandonment_step: FUNNEL_STEPS.ACTIVATION.SIGNUP_START,
          abandonment_reason: "form_error",
          step_count: 2,
          error: "Email already exists",
        }),
        undefined
      );
    });

    it("should calculate completion rate on abandonment", () => {
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.SIGNUP_START);

      trackFunnelAbandonment(mockPostHog, "ACTIVATION");

      const totalSteps = Object.keys(FUNNEL_STEPS.ACTIVATION).length;
      const completedSteps = 2;
      const expectedCompletionRate = (completedSteps / totalSteps) * 100;

      expect(trackEvent).toHaveBeenLastCalledWith(
        mockPostHog,
        expect.any(String),
        expect.objectContaining({
          completion_rate: expectedCompletionRate,
        }),
        undefined
      );
    });
  });

  describe("trackExitIntent", () => {
    it("should abandon all active funnels on exit", () => {
      // Start multiple funnels
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);
      trackFunnelStep(mockPostHog, "PURCHASE", FUNNEL_STEPS.PURCHASE.PRICING_VIEW);

      jest.clearAllMocks();

      trackExitIntent(mockPostHog, "/pricing", { time_on_page: 30 });

      // Should abandon both funnels
      expect(trackEvent).toHaveBeenCalledTimes(2);
      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        expect.any(String),
        expect.objectContaining({
          funnel_name: "ACTIVATION",
          abandonment_reason: "exit_intent",
          exit_page: "/pricing",
        }),
        undefined
      );
    });

    it("should handle no active funnels", () => {
      expect(() => {
        trackExitIntent(mockPostHog, "/home");
      }).not.toThrow();

      expect(trackEvent).not.toHaveBeenCalled();
    });
  });

  describe("Specialized funnel functions", () => {
    it("should track activation funnel steps", () => {
      trackActivationFunnel(mockPostHog, "LANDING", { source: "google" });

      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        expect.any(String),
        expect.objectContaining({
          funnel_name: "ACTIVATION",
          entry_step: FUNNEL_STEPS.ACTIVATION.LANDING,
          source: "google",
        }),
        undefined
      );
    });

    it("should track purchase funnel steps", () => {
      trackPurchaseFunnel(mockPostHog, "CHECKOUT_START", { plan: "pro" }, "user-123");

      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        expect.any(String),
        expect.objectContaining({
          funnel_name: "PURCHASE",
          entry_step: FUNNEL_STEPS.PURCHASE.CHECKOUT_START,
          plan: "pro",
        }),
        "user-123"
      );
    });

    it("should track retention funnel steps", () => {
      trackRetentionFunnel(mockPostHog, "DASHBOARD");

      expect(trackEvent).toHaveBeenCalledWith(
        mockPostHog,
        expect.any(String),
        expect.objectContaining({
          funnel_name: "RETENTION",
          entry_step: FUNNEL_STEPS.RETENTION.DASHBOARD,
        }),
        undefined
      );
    });
  });

  describe("Funnel metrics", () => {
    it("should calculate funnel dropoff percentage", () => {
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);
      trackFunnelStep(mockPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.SIGNUP_START);

      const dropoff = calculateFunnelDropoff(mockPostHog, "ACTIVATION");
      const totalSteps = Object.keys(FUNNEL_STEPS.ACTIVATION).length;
      const completedSteps = 2;
      const expectedDropoff = ((totalSteps - completedSteps) / totalSteps) * 100;

      expect(dropoff).toBe(expectedDropoff);
    });

    it("should return 0 dropoff for non-existent funnel", () => {
      const dropoff = calculateFunnelDropoff(mockPostHog, "ACTIVATION");
      expect(dropoff).toBe(0);
    });

    it("should get comprehensive funnel metrics", () => {
      const mockNow = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(mockNow);

      trackFunnelStep(mockPostHog, "PURCHASE", FUNNEL_STEPS.PURCHASE.PRICING_VIEW, {
        source: "email",
      });
      trackFunnelStep(mockPostHog, "PURCHASE", FUNNEL_STEPS.PURCHASE.PLAN_SELECT);

      const metrics = getFunnelMetrics("PURCHASE");

      expect(metrics).toEqual({
        currentStep: FUNNEL_STEPS.PURCHASE.PLAN_SELECT,
        stepCount: 2,
        totalSteps: Object.keys(FUNNEL_STEPS.PURCHASE).length,
        completionRate: (2 / Object.keys(FUNNEL_STEPS.PURCHASE).length) * 100,
        totalTime: expect.any(Number),
        averageStepTime: expect.any(Number),
        metadata: { source: "email" },
      });
    });

    it("should return null for non-existent funnel metrics", () => {
      const metrics = getFunnelMetrics("ACTIVATION");
      expect(metrics).toBeNull();
    });
  });

  describe("Type safety without React hooks", () => {
    it("should work with any PostHog-like object", () => {
      const customPostHog = {
        capture: jest.fn(),
        identify: jest.fn(),
      };

      expect(() => {
        trackFunnelStep(customPostHog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION.LANDING);
        trackFunnelComplete(customPostHog, "ACTIVATION");
        trackFunnelAbandonment(customPostHog, "ACTIVATION");
      }).not.toThrow();
    });
  });
});
