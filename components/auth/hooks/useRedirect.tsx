"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UseRedirectOptions {
  /** Path to redirect to */
  redirectPath?: string;
  /** Whether to automatically redirect */
  autoRedirect?: boolean;
  /** Delay before redirect in milliseconds */
  redirectDelay?: number;
}

export interface UseRedirectReturn {
  /** Current countdown value in seconds */
  countdown: number;
  /** Function to trigger manual redirect */
  triggerRedirect: () => void;
  /** Whether auto-redirect is active */
  isAutoRedirecting: boolean;
}

/**
 * Custom hook for managing redirects with countdown functionality.
 * Provides both automatic and manual redirect capabilities.
 */
export function useRedirect({
  redirectPath,
  autoRedirect = false,
  redirectDelay = 3000,
}: UseRedirectOptions): UseRedirectReturn {
  const router = useRouter();
  const [countdown, setCountdown] = useState(Math.ceil(redirectDelay / 1000));
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false);

  useEffect(() => {
    if (!autoRedirect || !redirectPath) return;

    setIsAutoRedirecting(true);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          router.push(redirectPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
      setIsAutoRedirecting(false);
    };
  }, [autoRedirect, redirectPath, redirectDelay, router]);

  const triggerRedirect = useCallback(() => {
    if (redirectPath) {
      router.push(redirectPath);
    }
  }, [redirectPath, router]);

  return {
    countdown,
    triggerRedirect,
    isAutoRedirecting,
  };
}
