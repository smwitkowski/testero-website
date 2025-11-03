"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import type { BillingStatusResponse } from "@/app/api/billing/status/route";

export interface UseSubscriptionStatusOptions {
  /** Initial billing status if provided by SSR */
  initial?: BillingStatusResponse;
}

export interface UseSubscriptionStatusReturn {
  /** Whether user is a subscriber (active or valid trialing) */
  isSubscriber: boolean;
  /** Current subscription status */
  status: BillingStatusResponse["status"];
  /** Whether status is currently being fetched */
  isLoading: boolean;
  /** Manually trigger a refetch of subscription status */
  refetch: () => Promise<void>;
}

/**
 * Client-side hook for subscription status (UX decisions only).
 * Server remains authoritative for authorization.
 * 
 * @param options - Configuration options
 * @returns Subscription status and loading state
 */
export function useSubscriptionStatus(
  options?: UseSubscriptionStatusOptions
): UseSubscriptionStatusReturn {
  const { user } = useAuth();
  const [status, setStatus] = useState<BillingStatusResponse>(
    options?.initial || { isSubscriber: false, status: "none" }
  );
  const [isLoading, setIsLoading] = useState(!options?.initial);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/billing/status");
      
      if (!response || !response.ok) {
        throw new Error(`Failed to fetch billing status: ${response?.status || "unknown"}`);
      }

      const data: BillingStatusResponse = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      // Fail gracefully - default to non-subscriber
      setStatus({ isSubscriber: false, status: "none" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Track previous user ID to detect changes
  const prevUserIdRef = useRef<string | undefined>(user?.id);
  const hasFetchedRef = useRef(false);

  // Fetch on mount if no initial value provided
  useEffect(() => {
    if (!options?.initial && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Re-fetch when user ID changes (but not on initial mount)
  useEffect(() => {
    if (!options?.initial && hasFetchedRef.current) {
      // If user logged out (user?.id became undefined), reset to non-subscriber
      if (!user?.id && prevUserIdRef.current) {
        setStatus({ isSubscriber: false, status: "none" });
        setIsLoading(false);
      }
      // If user ID changed (login or account switch), refetch
      else if (user?.id && prevUserIdRef.current !== user?.id) {
        fetchStatus();
      }
    }
    prevUserIdRef.current = user?.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
    isSubscriber: status.isSubscriber,
    status: status.status,
    isLoading,
    refetch: fetchStatus,
  };
}

