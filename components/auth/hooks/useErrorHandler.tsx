"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UseErrorHandlerOptions {
  /** Retry function */
  onRetry?: () => void;
  /** Path to redirect to */
  redirectPath?: string;
}

export interface UseErrorHandlerReturn {
  /** Function to trigger retry action */
  triggerRetry: () => void;
  /** Function to trigger redirect action */
  triggerRedirect: () => void;
  /** Whether retry is available */
  canRetry: boolean;
  /** Whether redirect is available */
  canRedirect: boolean;
}

/**
 * Custom hook for managing error handling actions.
 * Provides standardized retry and redirect functionality.
 */
export function useErrorHandler({
  onRetry,
  redirectPath,
}: UseErrorHandlerOptions): UseErrorHandlerReturn {
  const router = useRouter();

  const triggerRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    }
  }, [onRetry]);

  const triggerRedirect = useCallback(() => {
    if (redirectPath) {
      router.push(redirectPath);
    }
  }, [redirectPath, router]);

  return {
    triggerRetry,
    triggerRedirect,
    canRetry: Boolean(onRetry),
    canRedirect: Boolean(redirectPath),
  };
}
