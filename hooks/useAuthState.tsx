"use client";

import { useState, useCallback } from "react";
import { usePostHog } from "posthog-js/react";

// Single source of truth for AuthState type
export type AuthState = "loading" | "form" | "success" | "error";
export type AuthFlow = "signup" | "login" | "reset" | "verify" | "forgot";

export interface UseAuthStateOptions {
  /** Initial state to start with */
  initialState?: AuthState;
  /** Auth flow type for analytics */
  flow?: AuthFlow;
  /** Callback when state changes */
  onStateChange?: (newState: AuthState) => void;
  /** Callback on success */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export interface UseAuthStateReturn {
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
  reset: () => void;

  // State checks
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;

  // Analytics
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
}

/**
 * Unified hook for managing authentication flow states.
 * Provides a consistent way to handle loading, form, success, and error states
 * with optional analytics tracking and callbacks.
 */
export function useAuthState({
  initialState = "form",
  flow,
  onStateChange,
  onSuccess,
  onError,
}: UseAuthStateOptions = {}): UseAuthStateReturn {
  const [state, setStateInternal] = useState<AuthState>(initialState);
  const [isSubmitting, setIsSubmittingInternal] = useState(false);
  const [error, setErrorInternal] = useState<string | null>(null);
  const posthog = usePostHog();

  const trackEvent = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      if (posthog && flow) {
        posthog.capture(eventName, {
          auth_flow: flow,
          ...properties,
        });
      } else if (posthog) {
        posthog.capture(eventName, properties);
      }
    },
    [posthog, flow]
  );

  const setState = useCallback(
    (newState: AuthState) => {
      setStateInternal(newState);
      if (onStateChange) {
        onStateChange(newState);
      }
    },
    [onStateChange]
  );

  const setSubmitting = useCallback((submitting: boolean) => {
    setIsSubmittingInternal(submitting);
    if (submitting) {
      setErrorInternal(null);
    }
  }, []);

  const setError = useCallback((error: string | null) => {
    setErrorInternal(error);
  }, []);

  const clearError = useCallback(() => {
    setErrorInternal(null);
  }, []);

  const startSubmitting = useCallback(() => {
    setSubmitting(true);
    if (flow) {
      trackEvent(`${flow}_attempt_start`);
    }
  }, [setSubmitting, trackEvent, flow]);

  const finishSubmitting = useCallback(() => {
    setSubmitting(false);
  }, [setSubmitting]);

  const handleSuccess = useCallback(() => {
    setState("success");
    setIsSubmittingInternal(false);
    setErrorInternal(null);
    if (flow) {
      trackEvent(`${flow}_success`);
    }
    onSuccess?.();
  }, [flow, trackEvent, onSuccess, setState]);

  const handleError = useCallback(
    (err: string | Error) => {
      const errorMessage = err instanceof Error ? err.message : err;
      setState("error");
      setIsSubmittingInternal(false);
      setErrorInternal(errorMessage);
      if (flow) {
        trackEvent(`${flow}_error`, { error_message: errorMessage });
      }
      onError?.(errorMessage);
    },
    [flow, trackEvent, onError, setState]
  );

  const reset = useCallback(() => {
    setState(initialState);
    setErrorInternal(null);
    setIsSubmittingInternal(false);
  }, [initialState, setState]);

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
    reset,

    // State checks
    isLoading: state === "loading",
    isSuccess: state === "success",
    isError: state === "error",

    // Analytics
    trackEvent,
  };
}
