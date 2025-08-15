// Type for PostHog client (both client-side and server-side)
export type PostHogClient =
  | {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      capture: (event: string, properties?: Record<string, any>) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      identify: (userId: string, properties?: Record<string, any>) => void;
    }
  | {
      capture: (params: {
        distinctId: string;
        event: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties?: Record<string, any>;
      }) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      identify: (params: { distinctId: string; properties?: Record<string, any> }) => void;
      shutdown?: () => void;
    }
  | null;

// For typing purposes in client-side code
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PostHog = any;

// Event names as constants to prevent typos and ensure consistency
export const ANALYTICS_EVENTS = {
  // Authentication & Session
  USER_SESSION_STARTED: "user_session_started",
  USER_SESSION_ENDED: "user_session_ended",
  USER_IDENTIFIED: "user_identified",
  SIGNUP_ATTEMPT: "signup_attempt",
  SIGNUP_SUCCESS: "signup_success",
  SIGNUP_ERROR: "signup_error",
  LOGIN_ATTEMPT: "login_attempt",
  LOGIN_ERROR: "login_error",

  // Dashboard
  DASHBOARD_VIEWED: "dashboard_viewed",
  DASHBOARD_LOADED: "dashboard_loaded",
  DASHBOARD_ERROR: "dashboard_error",

  // Diagnostic
  DIAGNOSTIC_STARTED: "diagnostic_started",
  DIAGNOSTIC_RESUME_SHOWN: "diagnostic_resume_shown",
  DIAGNOSTIC_RESUMED: "diagnostic_resumed",
  DIAGNOSTIC_QUESTION_ANSWERED: "diagnostic_question_answered",
  DIAGNOSTIC_COMPLETED: "diagnostic_completed",
  DIAGNOSTIC_ABANDONED: "diagnostic_abandoned",

  // Study Path
  STUDY_PATH_VIEWED: "study_path_viewed",
  STUDY_PATH_GENERATED: "study_path_generated",
  STUDY_PATH_ERROR: "study_path_error",

  // Practice Questions
  PRACTICE_PAGE_VIEWED: "practice_page_viewed",
  PRACTICE_QUESTION_LOADED: "practice_question_loaded",
  PRACTICE_QUESTION_ANSWERED: "practice_question_answered",
  PRACTICE_QUESTION_ERROR: "practice_question_error",

  // Subscription & Billing
  SUBSCRIPTION_CREATED: "subscription_created",
  SUBSCRIPTION_UPDATED: "subscription_updated",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  PAYMENT_FAILED: "payment_failed",
  CHECKOUT_INITIATED: "checkout_initiated",
  CHECKOUT_SESSION_CREATED: "checkout_session_created",
  CHECKOUT_ERROR: "checkout_error",
  BILLING_PORTAL_ACCESSED: "billing_portal_accessed",

  // Pricing
  PRICING_PAGE_VIEWED: "pricing_page_viewed",
  PRICING_PLAN_SELECTED: "pricing_plan_selected",

  // Errors
  UNHANDLED_ERROR: "unhandled_error",
  ERROR_RECOVERY_ATTEMPTED: "error_recovery_attempted",

  // Email Verification
  EMAIL_VERIFICATION_PAGE_VIEWED: "email_verification_page_viewed",
  EMAIL_CONFIRMED: "email_confirmed",
  EMAIL_VERIFICATION_ERROR: "email_verification_error",

  // Conversion Events
  TRIAL_STARTED: "trial_started",
  TRIAL_TO_PAID_CONVERSION: "trial_to_paid_conversion",

  // Feature Discovery
  FEATURE_DISCOVERED: "feature_discovered",
  FEATURE_USED: "feature_used",

  // Beta Onboarding Flow
  BETA_STARTED: "beta_started",
  START_DIAGNOSTIC_CLICKED: "start_diagnostic_clicked", 
  DIAGNOSTIC_SESSION_CREATED: "diagnostic_session_created",
  SKIP_DIAGNOSTIC_CLICKED: "skip_diagnostic_clicked",
} as const;

// User property keys for consistency
export const USER_PROPERTIES = {
  EMAIL: "email",
  USER_ID: "user_id",
  SUBSCRIPTION_TIER: "subscription_tier",
  SUBSCRIPTION_STATUS: "subscription_status",
  IS_PAYING_CUSTOMER: "is_paying_customer",
  IS_TRIAL: "is_trial",
  CUSTOMER_SINCE: "customer_since",
  CHURNED_AT: "churned_at",
  EXAM_TYPE: "exam_type",
  READINESS_SCORE: "readiness_score",
  TOTAL_PRACTICE_QUESTIONS: "total_practice_questions",
  ACCURACY_PERCENTAGE: "accuracy_percentage",
  PLAN_TIER: "plan_tier",
  IS_EARLY_ACCESS: "is_early_access",
  EMAIL_VERIFIED: "email_verified",
} as const;

// Helper types
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
export type UserProperty = (typeof USER_PROPERTIES)[keyof typeof USER_PROPERTIES];

// Helper function to track events with proper typing
export function trackEvent(
  posthog: PostHogClient | PostHog,
  event: AnalyticsEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  distinctId?: string
) {
  if (!posthog) return;

  // Check if it's server-side PostHog (has distinctId parameter in capture)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (distinctId && posthog && typeof (posthog as any).capture === "function") {
    // Server-side PostHog
    (posthog as PostHog).capture({
      distinctId,
      event,
      properties: properties || {},
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (posthog && typeof (posthog as any).capture === "function") {
    // Client-side PostHog
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (posthog as any).capture(event, properties);
  }
}

// Helper function to identify users with proper typing
export function identifyUser(
  posthog: PostHogClient | PostHog,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Partial<Record<UserProperty, any>>
) {
  if (!posthog) return;

  // Check if it's server-side PostHog (has shutdown method)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((posthog as any)?.shutdown) {
    // Server-side PostHog
    (posthog as PostHog).identify({
      distinctId: userId,
      properties: properties || {},
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } else if (posthog && typeof (posthog as any).identify === "function") {
    // Client-side PostHog
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (posthog as any).identify(userId, properties);
  }
}

// Helper function to track conversion events
export function trackConversion(
  posthog: PostHogClient | PostHog,
  conversionType: string,
  value: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  const conversionData = {
    conversion_type: conversionType,
    conversion_value: value,
    ...properties,
  };

  trackEvent(posthog, ANALYTICS_EVENTS.TRIAL_TO_PAID_CONVERSION, conversionData, userId);
}

// Helper function to track errors consistently
export function trackError(
  posthog: PostHogClient | PostHog,
  error: Error | string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: Record<string, any>,
  userId?: string
) {
  const errorData = {
    error_message: typeof error === "string" ? error : error.message,
    error_stack: typeof error === "object" ? error.stack : undefined,
    error_name: typeof error === "object" ? error.name : "Error",
    ...context,
  };

  trackEvent(posthog, ANALYTICS_EVENTS.UNHANDLED_ERROR, errorData, userId);
}

// Helper function to calculate and track engagement metrics
export function trackEngagement(
  posthog: PostHogClient | PostHog,
  engagementType: "session_duration" | "page_depth" | "feature_interaction",
  value: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>,
  userId?: string
) {
  const eventData = {
    engagement_type: engagementType,
    engagement_value: value,
    ...properties,
  };

  trackEvent(posthog, ANALYTICS_EVENTS.FEATURE_USED, eventData, userId);
}
