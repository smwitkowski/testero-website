"use client";

import React from "react";
import { motion } from "framer-motion";
import { LoadingSpinner } from "./LoadingSpinner";

export interface AuthLoadingStateProps {
  /** The title to display above the loading message */
  title?: string;
  /** The descriptive message to show users */
  message?: string;
  /** Size of the loading spinner */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes to apply to the container */
  className?: string;
}

/**
 * Universal loading state component for authentication flows.
 * Provides consistent loading UI with accessibility features.
 */
export const AuthLoadingState = React.memo<AuthLoadingStateProps>(
  ({ title = "Loading", message = "Please wait...", size = "md", className = "" }) => {
    const ariaLabel = `Loading: ${title}`;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`text-center space-y-6 ${className}`}
      >
        <div
          className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100"
          role="status"
          aria-live="polite"
          aria-label={ariaLabel}
        >
          <LoadingSpinner size={size} color="primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-slate-900">{title}</h3>
          <p className="text-slate-600">{message}</p>
        </div>
      </motion.div>
    );
  }
);

AuthLoadingState.displayName = "AuthLoadingState";
