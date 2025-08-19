"use client";

import { useState, useCallback } from "react";
import { usePostHog } from "posthog-js/react";

export type AuthFlow = "signup" | "login" | "reset" | "verify" | "forgot";
export type AuthState = "loading" | "form" | "success" | "error";

interface UseAuthStateOptions {
  flow: AuthFlow;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UseAuthStateReturn {
  // State
  state: AuthState;
  isSubmitting: boolean;
  error: string | null;

  // Actions
  setState: (state: AuthState) => void;
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Convenience methods
  startSubmitting: () => void;
  finishSubmitting: () => void;
  handleSuccess: () => void;
  handleError: (error: string | Error) => void;

  // Analytics
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
}

export function useAuthState({
  flow,
  onSuccess,
  onError,
}: UseAuthStateOptions): UseAuthStateReturn {
  const [state, setState] = useState<AuthState>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posthog = usePostHog();

  const trackEvent = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      if (posthog) {
        posthog.capture(eventName, {
          auth_flow: flow,
          ...properties,
        });
      }
    },
    [posthog, flow]
  );

  const setSubmitting = useCallback((submitting: boolean) => {
    setIsSubmitting(submitting);
    if (submitting) {
      setError(null);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startSubmitting = useCallback(() => {
    setSubmitting(true);
    trackEvent(`${flow}_attempt_start`);
  }, [setSubmitting, trackEvent, flow]);

  const finishSubmitting = useCallback(() => {
    setSubmitting(false);
  }, []);

  const handleSuccess = useCallback(() => {
    setState("success");
    setIsSubmitting(false);
    setError(null);
    trackEvent(`${flow}_success`);
    onSuccess?.();
  }, [flow, trackEvent, onSuccess]);

  const handleError = useCallback(
    (err: string | Error) => {
      const errorMessage = err instanceof Error ? err.message : err;
      setState("error");
      setIsSubmitting(false);
      setError(errorMessage);
      trackEvent(`${flow}_error`, { error_message: errorMessage });
      onError?.(errorMessage);
    },
    [flow, trackEvent, onError]
  );

  return {
    // State
    state,
    isSubmitting,
    error,

    // Actions
    setState,
    setSubmitting,
    setError,
    clearError,

    // Convenience methods
    startSubmitting,
    finishSubmitting,
    handleSuccess,
    handleError,

    // Analytics
    trackEvent,
  };
}
