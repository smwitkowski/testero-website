"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/analytics";
import { getPassAnalyticsProperties } from "@/lib/pricing/price-utils";

// Keep the exported name for existing callers. The offer is always PMLE Pass.
export function useStartBasicCheckout() {
  const router = useRouter();
  const posthog = usePostHog();
  const { user } = useAuth();
  const inFlightRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const startBasicCheckout = useCallback(async (source: string) => {
    if (inFlightRef.current) return;
    const properties = { ...getPassAnalyticsProperties(), source, user_id: user?.id };
    trackEvent(posthog, ANALYTICS_EVENTS.UPGRADE_CTA_CLICKED, properties);
    if (!user) {
      trackEvent(posthog, ANALYTICS_EVENTS.UPGRADE_SIGNUP_REDIRECT, properties);
      router.push("/signup?redirect=/pricing");
      return;
    }

    inFlightRef.current = true;
    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_INITIATED, properties);
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idempotencyKeyRef.current }),
      });
      const data = (await response.json()) as { error?: string; url?: string };
      if (!response.ok) throw new Error(data.error || "Failed to create checkout session");
      if (!data.url) throw new Error("No checkout URL returned from server");
      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_SESSION_CREATED, properties);
      window.location.href = data.url;
    } catch (error) {
      // Preserve the key for retries, and show checkout errors on the pricing page.
      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
        ...properties,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      router.push("/pricing?checkout=error");
    } finally {
      inFlightRef.current = false;
    }
  }, [posthog, router, user]);

  return { startBasicCheckout };
}
