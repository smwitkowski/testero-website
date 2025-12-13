"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/analytics";

const BASIC_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY;

export function useStartBasicCheckout() {
  const router = useRouter();
  const posthog = usePostHog();
  const { user } = useAuth();
  const inFlightRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const startBasicCheckout = useCallback(
    async (source: string) => {
      // Prevent accidental double-submit (e.g., double-click, repeated modal CTA taps).
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }

      posthog?.capture(ANALYTICS_EVENTS.UPGRADE_CTA_CLICKED, {
        source,
        user_id: user?.id,
      });

      // For anonymous users, always redirect to signup even if price ID is missing
      // This ensures signup flows work regardless of Stripe configuration
      if (!user) {
        if (!BASIC_MONTHLY_PRICE_ID) {
          // Log warning for configuration issues but don't block UX
          console.warn("Basic monthly price ID is not configured - signup redirect will proceed");
          trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
            source,
            error: "missing_basic_monthly_price_id",
            user_state: "anonymous",
          });
        }
        trackEvent(posthog, ANALYTICS_EVENTS.UPGRADE_SIGNUP_REDIRECT, {
          source,
        });
        router.push("/signup?redirect=/pricing");
        return;
      }

      // For authenticated users, require price ID before initiating checkout
      if (!BASIC_MONTHLY_PRICE_ID) {
        console.error("Basic monthly price ID is not configured");
        trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
          source,
          error: "missing_basic_monthly_price_id",
          user_state: "authenticated",
        });
        // Redirect to pricing page as fallback instead of silent failure
        router.push("/pricing");
        return;
      }

      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_INITIATED, {
        source,
        price_id: BASIC_MONTHLY_PRICE_ID,
        billing_interval: "monthly",
        plan_name: "PMLE Readiness",
        user_id: user.id,
      });

      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": idempotencyKeyRef.current,
          },
          body: JSON.stringify({
            priceId: BASIC_MONTHLY_PRICE_ID,
            idempotencyKey: idempotencyKeyRef.current,
          }),
        });

        const data = (await response.json()) as { error?: string; url?: string };

        if (!response.ok) {
          throw new Error(data.error || "Failed to create checkout session");
        }

        trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_SESSION_CREATED, {
          source,
          price_id: BASIC_MONTHLY_PRICE_ID,
          billing_interval: "monthly",
          plan_name: "PMLE Readiness",
          user_id: user.id,
        });

        if (data.url) {
          window.location.href = data.url;
        }
      } catch (error) {
        console.error("Error starting checkout:", error);
        // Allow retries after a failure
        idempotencyKeyRef.current = null;
        trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
          source,
          price_id: BASIC_MONTHLY_PRICE_ID,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [posthog, router, user]
  );

  return { startBasicCheckout };
}
