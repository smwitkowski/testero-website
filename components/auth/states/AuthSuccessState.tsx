"use client";

import React, { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRedirect } from "../hooks/useRedirect";

export interface AuthSuccessStateProps {
  /** The title to display */
  title?: string;
  /** The success message to show users */
  message?: string;
  /** Path to redirect to */
  redirectPath?: string;
  /** Whether to automatically redirect */
  autoRedirect?: boolean;
  /** Delay before redirect in milliseconds */
  redirectDelay?: number;
  /** Action button configuration */
  actionButton?: {
    text: string;
    action: "redirect" | (() => void);
  };
  /** Callback when component mounts */
  onMount?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Universal success state component for authentication flows.
 * Provides consistent success UI with redirect functionality.
 */
export const AuthSuccessState = React.memo<AuthSuccessStateProps>(
  ({
    title = "Success!",
    message = "Operation completed successfully.",
    redirectPath,
    autoRedirect = false,
    redirectDelay = 3000,
    actionButton,
    onMount,
    className = "",
  }) => {
    const { countdown, triggerRedirect, isAutoRedirecting } = useRedirect({
      redirectPath,
      autoRedirect,
      redirectDelay,
    });

    useEffect(() => {
      if (onMount) {
        onMount();
      }
    }, [onMount]);

    const handleActionClick = useCallback(() => {
      if (!actionButton) return;

      if (actionButton.action === "redirect") {
        triggerRedirect();
      } else if (typeof actionButton.action === "function") {
        actionButton.action();
      }
    }, [actionButton, triggerRedirect]);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`text-center space-y-6 ${className}`}
      >
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            role="img"
            aria-label="Success icon"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-medium text-slate-900">{title}</h3>
          <p className="text-slate-600">{message}</p>

          {isAutoRedirecting && (
            <p className="text-slate-500 text-sm">Redirecting in {countdown} seconds...</p>
          )}

          {actionButton && (
            <button
              onClick={handleActionClick}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md transition-all"
            >
              {actionButton.text}
            </button>
          )}
        </div>
      </motion.div>
    );
  }
);

AuthSuccessState.displayName = "AuthSuccessState";
