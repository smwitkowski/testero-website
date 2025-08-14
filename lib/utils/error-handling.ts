/**
 * Standardized error handling utilities for consistent error processing
 */

/**
 * Extract error message from various error types
 * @param error - The error to extract message from
 * @param fallback - Fallback message if no message can be extracted
 * @returns Standardized error message
 */
export const getErrorMessage = (error: unknown, fallback = "An unexpected error occurred"): string => {
  if (error instanceof Error) {
    return error.message || fallback;
  }
  
  if (typeof error === "string") {
    return error || fallback;
  }
  
  return fallback;
};

/**
 * Extract error message for API responses
 * @param response - Fetch response object
 * @returns Promise resolving to error message
 */
export const getApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    return data.error || data.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

/**
 * Standard error tracking for PostHog
 */
export interface ErrorTrackingOptions {
  userId?: string;
  errorType?: string;
  context?: Record<string, unknown>;
}

// PostHog instance type
type PostHogInstance = {
  capture: (eventName: string, properties?: Record<string, unknown>) => void;
};

export const trackError = (
  posthog: PostHogInstance | null | undefined,
  error: unknown,
  eventName: string,
  options: ErrorTrackingOptions = {}
): void => {
  if (!posthog) return;
  
  const errorMessage = getErrorMessage(error);
  
  posthog.capture(eventName, {
    error: errorMessage,
    error_type: options.errorType || "unknown",
    user_id: options.userId,
    timestamp: new Date().toISOString(),
    ...options.context,
  });
};