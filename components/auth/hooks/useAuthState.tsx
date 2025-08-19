"use client";

import { useState, useCallback } from "react";

export type AuthState = "loading" | "form" | "success" | "error";

export interface AuthStateOptions {
  /** Initial state to start with */
  initialState?: AuthState;
  /** Callback when state changes */
  onStateChange?: (newState: AuthState) => void;
}

export interface AuthStateReturn {
  /** Current authentication state */
  state: AuthState;
  /** Function to update the state */
  setState: (newState: AuthState) => void;
  /** Current error message */
  error: string | null;
  /** Function to set error message */
  setError: (error: string | null) => void;
  /** Whether currently in loading state */
  isLoading: boolean;
  /** Whether operation was successful */
  isSuccess: boolean;
  /** Whether there's an error */
  isError: boolean;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * Custom hook for managing authentication flow states.
 * Provides a consistent way to handle loading, form, success, and error states.
 */
export function useAuthState({
  initialState = "form",
  onStateChange,
}: AuthStateOptions = {}): AuthStateReturn {
  const [state, setStateInternal] = useState<AuthState>(initialState);
  const [error, setError] = useState<string | null>(null);

  const setState = useCallback(
    (newState: AuthState) => {
      setStateInternal(newState);
      if (onStateChange) {
        onStateChange(newState);
      }
    },
    [onStateChange]
  );

  const reset = useCallback(() => {
    setState(initialState);
    setError(null);
  }, [initialState, setState]);

  return {
    state,
    setState,
    error,
    setError,
    isLoading: state === "loading",
    isSuccess: state === "success",
    isError: state === "error",
    reset,
  };
}
