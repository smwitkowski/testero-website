"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/analytics";

const BASIC_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY;

export function useStartBasicCheckout() {
  const router = useRouter();
  const posthog = usePostHog();
  const { user } = useAuth();

  const startBasicCheckout = useCallback(
    async (source: string) => {
      posthog?.capture(ANALYTICS_EVENTS.UPGRADE_CTA_CLICKED, {
        source,
        user_id: user?.id,
      });

      if (!BASIC_MONTHLY_PRICE_ID) {
        console.error("Basic monthly price ID is not configured");
        trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
          source,
          error: "missing_basic_monthly_price_id",
        });
        return;
      }

      if (!user) {
        trackEvent(posthog, ANALYTICS_EVENTS.UPGRADE_SIGNUP_REDIRECT, {
          source,
        });
        router.push("/signup?redirect=/pricing");
        return;
      }

      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_INITIATED, {
        source,
        price_id: BASIC_MONTHLY_PRICE_ID,
        billing_interval: "monthly",
        plan_name: "Basic",
        user_id: user.id,
      });

      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ priceId: BASIC_MONTHLY_PRICE_ID }),
        });

        const data = (await response.json()) as { error?: string; url?: string };

        if (!response.ok) {
          throw new Error(data.error || "Failed to create checkout session");
        }

        trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_SESSION_CREATED, {
          source,
          price_id: BASIC_MONTHLY_PRICE_ID,
          billing_interval: "monthly",
          plan_name: "Basic",
          user_id: user.id,
        });

        if (data.url) {
          window.location.href = data.url;
        }
      } catch (error) {
        console.error("Error starting checkout:", error);
        trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
          source,
          price_id: BASIC_MONTHLY_PRICE_ID,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [posthog, router, user]
  );

  return { startBasicCheckout };
}
