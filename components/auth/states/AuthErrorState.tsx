"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useErrorHandler } from "../hooks/useErrorHandler";

export interface AuthErrorStateProps {
  /** The title to display */
  title?: string;
  /** The error message to show users */
  message?: string;
  /** Additional error details for debugging */
  errorDetails?: string;
  /** Error type for conditional rendering */
  errorType?: "network" | "validation" | "authentication" | "general";
  /** Retry function */
  onRetry?: () => void;
  /** Text for retry button */
  retryButtonText?: string;
  /** Path to redirect to */
  redirectPath?: string;
  /** Text for redirect button */
  redirectButtonText?: string;
  /** Callback when component mounts */
  onMount?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Universal error state component for authentication flows.
 * Provides consistent error UI with retry and redirect functionality.
 */
export const AuthErrorState = React.memo<AuthErrorStateProps>(
  ({
    title = "Error",
    message = "Something went wrong. Please try again.",
    errorDetails,
    onRetry,
    retryButtonText = "Try Again",
    redirectPath,
    redirectButtonText = "Go Back",
    onMount,
    className = "",
  }) => {
    const { triggerRetry, triggerRedirect, canRetry, canRedirect } = useErrorHandler({
      onRetry,
      redirectPath,
    });

    useEffect(() => {
      if (onMount) {
        onMount();
      }
    }, [onMount]);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`text-center space-y-6 ${className}`}
      >
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            role="img"
            aria-label="Error icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-medium text-slate-900">{title}</h3>
          <p className="text-slate-600">{message}</p>

          {errorDetails && (
            <div className="text-sm text-slate-500 bg-slate-50 rounded-md p-3 border">
              <p className="font-medium">Details:</p>
              <p className="mt-1">{errorDetails}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {canRetry && (
              <button
                onClick={triggerRetry}
                className="w-full sm:w-auto bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md transition-all"
              >
                {retryButtonText}
              </button>
            )}

            {canRedirect && (
              <button
                onClick={triggerRedirect}
                className="w-full sm:w-auto bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md transition-all"
              >
                {redirectButtonText}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

AuthErrorState.displayName = "AuthErrorState";
