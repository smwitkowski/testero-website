import { trackEvent, ANALYTICS_EVENTS } from "./analytics";
import { usePostHog } from "posthog-js/react";

// Funnel step definitions
export const FUNNEL_STEPS = {
  // Activation Funnel
  ACTIVATION: {
    LANDING: "activation_landing",
    SIGNUP_START: "activation_signup_start",
    EMAIL_VERIFY: "activation_email_verify",
    FIRST_DIAGNOSTIC: "activation_first_diagnostic",
    DIAGNOSTIC_COMPLETE: "activation_diagnostic_complete",
    ACTIVATED: "activation_complete",
  },

  // Purchase Funnel
  PURCHASE: {
    PRICING_VIEW: "purchase_pricing_view",
    PLAN_SELECT: "purchase_plan_select",
    CHECKOUT_START: "purchase_checkout_start",
    PAYMENT_INFO: "purchase_payment_info",
    PAYMENT_COMPLETE: "purchase_payment_complete",
  },

  // Retention Funnel
  RETENTION: {
    LOGIN: "retention_login",
    DASHBOARD: "retention_dashboard",
    PRACTICE_START: "retention_practice_start",
    PRACTICE_COMPLETE: "retention_practice_complete",
    RETURN_NEXT_DAY: "retention_return_next_day",
    RETURN_WEEK: "retention_return_week",
  },

  // Feature Adoption Funnel
  FEATURE_ADOPTION: {
    DISCOVER: "feature_adoption_discover",
    TRY: "feature_adoption_try",
    USE: "feature_adoption_use",
    HABIT: "feature_adoption_habit",
  },
} as const;

// Type definitions
export type FunnelName = keyof typeof FUNNEL_STEPS;
export type FunnelStep<T extends FunnelName> =
  (typeof FUNNEL_STEPS)[T][keyof (typeof FUNNEL_STEPS)[T]];

// Funnel state management
const FUNNEL_STORAGE_KEY = "testero_funnel_state";

interface FunnelState {
  [key: string]: {
    currentStep: string;
    startTime: number;
    stepTimes: Record<string, number>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
  };
}

// Get current funnel state from sessionStorage
function getFunnelState(): FunnelState {
  if (typeof window === "undefined") return {};

  const stored = sessionStorage.getItem(FUNNEL_STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}

// Save funnel state to sessionStorage
function saveFunnelState(state: FunnelState) {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(state));
}

// Track funnel step progression
export function trackFunnelStep<T extends FunnelName>(
  posthog: ReturnType<typeof usePostHog> | null,
  funnelName: T,
  step: FunnelStep<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  if (!posthog) return;

  const state = getFunnelState();
  const now = Date.now();
  const stepStr = step as string; // Type assertion for string indexing

  // Initialize funnel if first step
  if (!state[funnelName]) {
    state[funnelName] = {
      currentStep: stepStr,
      startTime: now,
      stepTimes: { [stepStr]: now },
      metadata: properties,
    };
  } else {
    // Calculate time since last step
    const lastStepTime = Math.max(...Object.values(state[funnelName].stepTimes));
    const timeSinceLastStep = now - lastStepTime;
    const totalFunnelTime = now - state[funnelName].startTime;

    // Update state
    state[funnelName].currentStep = stepStr;
    state[funnelName].stepTimes[stepStr] = now;

    // Track step transition
    trackEvent(
      posthog,
      ANALYTICS_EVENTS.FEATURE_USED,
      {
        funnel_name: funnelName,
        funnel_step: stepStr,
        previous_step: state[funnelName].currentStep,
        time_since_last_step: timeSinceLastStep,
        total_funnel_time: totalFunnelTime,
        step_number: Object.keys(state[funnelName].stepTimes).length,
        ...properties,
      },
      userId
    );
  }

  saveFunnelState(state);

  // Track funnel entry
  if (Object.keys(state[funnelName].stepTimes).length === 1) {
    trackEvent(
      posthog,
      ANALYTICS_EVENTS.FEATURE_DISCOVERED,
      {
        funnel_name: funnelName,
        entry_step: stepStr,
        discovery_type: "funnel_start",
        ...properties,
      },
      userId
    );
  }
}

// Track funnel completion
export function trackFunnelComplete<T extends FunnelName>(
  posthog: ReturnType<typeof usePostHog> | null,
  funnelName: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  if (!posthog) return;

  const state = getFunnelState();
  const funnelData = state[funnelName];

  if (!funnelData) {
    console.warn(`Funnel ${funnelName} not found in state`);
    return;
  }

  const now = Date.now();
  const totalTime = now - funnelData.startTime;
  const stepCount = Object.keys(funnelData.stepTimes).length;

  // Calculate step durations
  const stepDurations: Record<string, number> = {};
  const sortedSteps = Object.entries(funnelData.stepTimes).sort(([, a], [, b]) => a - b);

  for (let i = 0; i < sortedSteps.length - 1; i++) {
    const [currentStep, currentTime] = sortedSteps[i];
    const [, nextTime] = sortedSteps[i + 1];
    stepDurations[currentStep] = nextTime - currentTime;
  }

  // Track completion event
  trackEvent(
    posthog,
    ANALYTICS_EVENTS.TRIAL_TO_PAID_CONVERSION,
    {
      funnel_name: funnelName,
      total_time: totalTime,
      step_count: stepCount,
      step_durations: stepDurations,
      completion_rate: 100,
      ...funnelData.metadata,
      ...properties,
    },
    userId
  );

  // Clear funnel from state
  delete state[funnelName];
  saveFunnelState(state);
}

// Track funnel abandonment
export function trackFunnelAbandonment<T extends FunnelName>(
  posthog: ReturnType<typeof usePostHog> | null,
  funnelName: T,
  reason?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  if (!posthog) return;

  const state = getFunnelState();
  const funnelData = state[funnelName];

  if (!funnelData) return;

  const now = Date.now();
  const totalTime = now - funnelData.startTime;
  const lastStep = funnelData.currentStep;
  const stepCount = Object.keys(funnelData.stepTimes).length;

  // Track abandonment event
  trackEvent(
    posthog,
    ANALYTICS_EVENTS.DIAGNOSTIC_ABANDONED,
    {
      funnel_name: funnelName,
      abandonment_step: lastStep,
      abandonment_reason: reason,
      total_time: totalTime,
      step_count: stepCount,
      completion_rate: (stepCount / Object.keys(FUNNEL_STEPS[funnelName]).length) * 100,
      ...funnelData.metadata,
      ...properties,
    },
    userId
  );

  // Clear funnel from state
  delete state[funnelName];
  saveFunnelState(state);
}

// Helper to track exit intent
export function trackExitIntent(
  posthog: ReturnType<typeof usePostHog> | null,
  currentPage: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  const state = getFunnelState();
  const activeFunnels = Object.keys(state);

  if (activeFunnels.length > 0) {
    // User is leaving with active funnels
    activeFunnels.forEach((funnelName) => {
      trackFunnelAbandonment(
        posthog,
        funnelName as FunnelName,
        "exit_intent",
        {
          exit_page: currentPage,
          ...properties,
        },
        userId
      );
    });
  }
}

// Specialized funnel tracking functions
export function trackActivationFunnel(
  posthog: ReturnType<typeof usePostHog> | null,
  step: keyof typeof FUNNEL_STEPS.ACTIVATION,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  trackFunnelStep(posthog, "ACTIVATION", FUNNEL_STEPS.ACTIVATION[step], properties, userId);
}

export function trackPurchaseFunnel(
  posthog: ReturnType<typeof usePostHog> | null,
  step: keyof typeof FUNNEL_STEPS.PURCHASE,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  trackFunnelStep(posthog, "PURCHASE", FUNNEL_STEPS.PURCHASE[step], properties, userId);
}

export function trackRetentionFunnel(
  posthog: ReturnType<typeof usePostHog> | null,
  step: keyof typeof FUNNEL_STEPS.RETENTION,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  trackFunnelStep(posthog, "RETENTION", FUNNEL_STEPS.RETENTION[step], properties, userId);
}

// Funnel optimization helpers
export function calculateFunnelDropoff(
  posthog: ReturnType<typeof usePostHog> | null,
  funnelName: FunnelName
): number {
  const state = getFunnelState();
  const funnelData = state[funnelName];

  if (!funnelData) return 0;

  const totalSteps = Object.keys(FUNNEL_STEPS[funnelName]).length;
  const completedSteps = Object.keys(funnelData.stepTimes).length;

  return ((totalSteps - completedSteps) / totalSteps) * 100;
}

export function getFunnelMetrics(funnelName: FunnelName) {
  const state = getFunnelState();
  const funnelData = state[funnelName];

  if (!funnelData) return null;

  const now = Date.now();
  const totalTime = now - funnelData.startTime;
  const stepCount = Object.keys(funnelData.stepTimes).length;
  const totalSteps = Object.keys(FUNNEL_STEPS[funnelName]).length;

  return {
    currentStep: funnelData.currentStep,
    stepCount,
    totalSteps,
    completionRate: (stepCount / totalSteps) * 100,
    totalTime,
    averageStepTime: totalTime / stepCount,
    metadata: funnelData.metadata,
  };
}
