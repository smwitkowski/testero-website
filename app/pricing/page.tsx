"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  CheckCircle,
  Shield,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw,
  X,
  AlertCircle,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import {
  getTierNameFromPriceId,
  getPaymentMode,
  getPlanType,
} from "@/lib/pricing/price-utils";
import { PricingCard } from "@/components/pricing/PricingCard";
import { ComparisonTable } from "@/components/pricing/ComparisonTable";
import { FreeVsPaidComparison } from "@/components/pricing/FreeVsPaidComparison";
import { Container, Section } from "@/components/patterns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  SUBSCRIPTION_TIERS,
  VALUE_PROPS,
  FEATURE_COMPARISON,
  PRICING_FAQ,
} from "@/lib/pricing/constants";
import { cn } from "@/lib/utils";

const PLAN_HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Unlimited PMLE Practice",
    description: "Unlimited practice questions aligned with the exam blueprint, updated as the exam evolves.",
  },
  {
    icon: TrendingUp,
    title: "Domain-Targeted Drills",
    description: "Focus your study time on your weakest areas with personalized domain-level practice.",
  },
  {
    icon: Award,
    title: "Full Diagnostic + Readiness Score",
    description: "Get instant personalized readiness insights that pinpoint exactly what to study next.",
  },
];

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("annual");
  const [showComparison, setShowComparison] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorTimeoutRef = React.useRef<number | null>(null);
  const checkoutInFlightRef = useRef<Set<string>>(new Set());
  const checkoutIdempotencyKeyRef = useRef<Map<string, string>>(new Map());
  const { user } = useAuth();
  const router = useRouter();
  const posthog = usePostHog();

  // Filter out hidden tiers to show only visible plans
  const visibleTiers = SUBSCRIPTION_TIERS.filter((tier) => !tier.isHidden);

  // Track page view
  useEffect(() => {
    trackEvent(posthog, ANALYTICS_EVENTS.PRICING_PAGE_VIEWED, {
      user_id: user?.id,
      billing_interval: billingInterval,
    });
  }, [posthog, user, billingInterval]);

  const handleCheckout = async (priceId: string, planName: string) => {
    // Validate price ID format (Stripe price IDs start with price_)
    // If it's a fallback ID (tier-billing format), redirect to signup
    if (!priceId.startsWith("price_")) {
      trackEvent(posthog, ANALYTICS_EVENTS.SIGNUP_ATTEMPT, {
        plan_name: planName,
        source: "pricing_checkout_missing_price_id",
      });
      router.push("/signup?redirect=/pricing");
      return;
    }

    // Calculate analytics properties
    const tierName = getTierNameFromPriceId(priceId);
    const paymentMode = getPaymentMode(priceId);
    const planType = getPlanType(priceId);

    // Track checkout intent
    trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_INITIATED, {
      plan_name: planName,
      tier_name: tierName,
      billing_interval: billingInterval,
      price_id: priceId,
      payment_mode: paymentMode,
      plan_type: planType,
      user_id: user?.id,
    });

    // Require authentication
    if (!user) {
      trackEvent(posthog, ANALYTICS_EVENTS.SIGNUP_ATTEMPT, {
        plan_name: planName,
        source: "pricing_checkout_redirect",
      });
      router.push("/signup?redirect=/pricing");
      return;
    }

    // Guard against double-submits (double click / repeated taps) before state updates land.
    // Must check and acquire lock BEFORE try block to prevent concurrent finally blocks from clearing refs prematurely.
    if (checkoutInFlightRef.current.has(priceId)) {
      return;
    }
    checkoutInFlightRef.current.add(priceId);
    const acquiredLock = true;

    if (!checkoutIdempotencyKeyRef.current.has(priceId)) {
      checkoutIdempotencyKeyRef.current.set(priceId, crypto.randomUUID());
    }
    const idempotencyKey = checkoutIdempotencyKeyRef.current.get(priceId)!;

    setLoading(priceId);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          priceId,
          idempotencyKey,
        }),
      });

      const data = (await response.json()) as { error?: string; url?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Track successful checkout session creation
      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_SESSION_CREATED, {
        plan_name: planName,
        tier_name: tierName,
        billing_interval: billingInterval,
        price_id: priceId,
        payment_mode: paymentMode,
        plan_type: planType,
        user_id: user?.id,
      });

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
        // Clear idempotency key only on confirmed success/redirect
        checkoutIdempotencyKeyRef.current.delete(priceId);
      } else {
        throw new Error("No checkout URL returned from server");
      }
    } catch (error) {
      console.error("Checkout error:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
        error: errorMessage,
        plan_name: planName,
        tier_name: tierName,
        billing_interval: billingInterval,
        price_id: priceId,
        payment_mode: paymentMode,
        plan_type: planType,
        user_id: user?.id,
      });

      // Provide more specific error messages
      let userFriendlyError = "Failed to start checkout. Please try again.";
      if (errorMessage.includes("price") || errorMessage.includes("Price")) {
        userFriendlyError = "This plan is temporarily unavailable. Please contact support or try a different plan.";
      } else if (errorMessage.includes("session") || errorMessage.includes("Session")) {
        userFriendlyError = "Unable to create checkout session. Please refresh the page and try again.";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        userFriendlyError = "Network error. Please check your connection and try again.";
      }

      setError(userFriendlyError);
      // Error persists longer (10 seconds) and can be manually dismissed
      if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = window.setTimeout(() => setError(null), 10000);
      
      // Keep idempotency key on error for safe retries
    } finally {
      setLoading(null);
      // Only release lock if this invocation actually acquired it
      if (acquiredLock) {
        checkoutInFlightRef.current.delete(priceId);
      }
    }
  };

  const toggleBillingInterval = () => {
    const newInterval = billingInterval === "monthly" ? "annual" : "monthly";
    setBillingInterval(newInterval);
    trackEvent(posthog, ANALYTICS_EVENTS.PRICING_PLAN_SELECTED, {
      from_interval: billingInterval,
      to_interval: newInterval,
      action: "toggle_billing",
    });
  };

  // Clean up error timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section with Value Proposition */}
      <Section
        contained={false}
        size="xl"
        surface="brand"
        className="relative overflow-hidden bg-gradient-to-br from-[color:var(--tone-accent)] via-[color:var(--tone-accent)]/95 to-[color:var(--tone-accent)]/90 text-white"
      >
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.1))]" />
        <Container className="relative">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              {VALUE_PROPS.mainHeadline}
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
              {VALUE_PROPS.subHeadline}
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-8">
              {VALUE_PROPS.trustBadges.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2"
                >
                  <CheckCircle className="h-5 w-5 text-[color:var(--tone-success)]" />
                  <span className="text-sm sm:text-base font-medium">{badge}</span>
                </div>
              ))}
            </div>

            {/* Guarantees */}
            <div className="flex flex-wrap justify-center gap-6 text-sm sm:text-base mb-8">
              {VALUE_PROPS.guarantees.map((guarantee) => (
                <div key={guarantee} className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-yellow-400" />
                  <span>{guarantee}</span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      {/* Error Alert */}
      {error && (
        <Container className="mt-6">
          <div className="rounded-md bg-red-50 border border-red-200 p-4" role="alert">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
                <p className="text-xs text-red-600 mt-1">
                  If this problem persists, please{" "}
                  <a href="mailto:support@testero.ai" className="underline font-medium">
                    contact support
                  </a>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 flex-shrink-0"
                aria-label="Dismiss error"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Container>
      )}

      {/* Billing Toggle */}
      <Container className="py-8 relative z-10">
        <div className="flex justify-center">
          <div className="inline-flex items-center bg-white rounded-full shadow-lg p-1">
            <button
              onClick={() => billingInterval === "annual" && toggleBillingInterval()}
              className={cn(
                "px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200",
                billingInterval === "monthly"
                  ? "bg-[color:var(--tone-accent)] text-white"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => billingInterval === "monthly" && toggleBillingInterval()}
              className={cn(
                "px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                billingInterval === "annual"
                  ? "bg-[color:var(--tone-accent)] text-white"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              Annual
              {billingInterval === "annual" && (
                <Badge tone="success" variant="soft" size="sm" className="bg-emerald-700 text-white">
                  SAVE 25%
                </Badge>
              )}
            </button>
          </div>
        </div>
      </Container>

      {/* Main Pricing Cards */}
      <Section
        id="pricing-cards"
        size="xl"
        surface="subtle"
        divider="both"
      >
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            {visibleTiers.map((tier) => (
              <PricingCard
                key={tier.id}
                tier={tier}
                billingInterval={billingInterval}
                onCheckout={handleCheckout}
                loading={!!loading}
                loadingId={loading}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* Plan Highlights */}
      <Section size="xl" surface="subtle" divider="bottom">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">Everything You Need for PMLE Readiness</h2>
            <p className="text-gray-600 dark:text-slate-300">
              Full access to realistic PMLE questions, detailed explanations, and domain-level readiness insights.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLAN_HIGHLIGHTS.map((highlight) => {
              const Icon = highlight.icon;
              return (
                <div
                  key={highlight.title}
                  className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <Icon className="mx-auto mb-3 h-10 w-10 text-[color:var(--tone-accent)] dark:text-[color:var(--tone-accent)]" />
                  <h3 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">{highlight.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{highlight.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Free vs Paid Comparison */}
      <Section size="xl" surface="subtle" divider="bottom">
        <FreeVsPaidComparison />
      </Section>

      {/* Feature Comparison */}
      <Section size="xl" surface="subtle" divider="bottom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Compare Plans in Detail</h2>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="inline-flex items-center gap-2 text-[color:var(--tone-accent)] hover:text-[color:var(--tone-accent)]/80 font-semibold"
            >
              {showComparison ? "Hide" : "Show"} detailed comparison
              {showComparison ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          </div>

          {showComparison && (
            <ComparisonTable
              categories={FEATURE_COMPARISON}
              onSelectPlan={(planId) => {
                const element = document.getElementById("pricing-cards");
                element?.scrollIntoView({ behavior: "smooth" });
                // Find the matching tier and trigger checkout
                const tier = SUBSCRIPTION_TIERS.find((t) => t.id === planId);
                if (tier) {
                  const priceId =
                    billingInterval === "monthly" ? tier.monthlyPriceId : tier.annualPriceId;
                  if (priceId) {
                    handleCheckout(priceId, tier.name);
                  } else {
                    // Fallback: if no price ID, redirect to signup
                    trackEvent(posthog, ANALYTICS_EVENTS.SIGNUP_ATTEMPT, {
                      plan_name: tier.name,
                      source: "comparison_table_checkout",
                    });
                    router.push("/signup?redirect=/pricing");
                  }
                }
              }}
            />
          )}
      </Section>

      {/* FAQ Section */}
      <Section size="xl" surface="default" divider="bottom">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {PRICING_FAQ.map((faq, index) => (
              <div key={index} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900">{faq.question}</span>
                  {openFaqIndex === index ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </button>
                {openFaqIndex === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Final CTA */}
      <Section
        contained={false}
        size="xl"
        surface="brand"
        divider="top"
        className="bg-gradient-to-r from-[color:var(--tone-accent)] via-[color:var(--tone-accent)]/90 to-[color:var(--tone-accent)]/80"
      >
        <Container className="max-w-4xl text-center text-white">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Know Your Readiness?</h2>
          <p className="text-xl text-white/90 mb-8">
            Start with a free diagnostic. Upgrade when you want explanations and unlimited targeted practice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              tone="accent"
            >
              <Link href="/signup">Start Free Diagnostic</Link>
            </Button>
            <Button
              size="lg"
              variant="soft"
              tone="accent"
              onClick={() => {
                const element = document.getElementById("pricing-cards");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View Pricing Plans
            </Button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-white">
              <RefreshCw className="h-5 w-5" />
            <span>7-day money-back guarantee • Cancel anytime</span>
          </div>
        </Container>
      </Section>

      {/* Pricing Cards Anchor handled via Section id */}
    </div>
  );
}
