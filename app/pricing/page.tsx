"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  CheckCircle,
  Shield,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  Star,
  Zap,
  RefreshCw,
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
import { Container, Section } from "@/components/patterns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  SUBSCRIPTION_TIERS,
  EXAM_PACKAGES,
  VALUE_PROPS,
  FEATURE_COMPARISON,
  PRICING_FAQ,
  PRICING_TESTIMONIALS,
  AI_CREDIT_USAGE,
} from "@/lib/pricing/constants";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("annual");
  const [showComparison, setShowComparison] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showExamPackages, setShowExamPackages] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const posthog = usePostHog();

  // Track page view
  useEffect(() => {
    trackEvent(posthog, ANALYTICS_EVENTS.PRICING_PAGE_VIEWED, {
      user_id: user?.id,
      billing_interval: billingInterval,
    });
  }, [posthog, user, billingInterval]);

  const handleCheckout = async (priceId: string, planName: string) => {
    try {
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

      setLoading(priceId);

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
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
      }
    } catch (error) {
      console.error("Checkout error:", error);
      // Calculate analytics properties for error tracking
      const tierName = getTierNameFromPriceId(priceId);
      const paymentMode = getPaymentMode(priceId);
      const planType = getPlanType(priceId);

      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
        error: error instanceof Error ? error.message : "Unknown error",
        plan_name: planName,
        tier_name: tierName,
        billing_interval: billingInterval,
        price_id: priceId,
        payment_mode: paymentMode,
        plan_type: planType,
        user_id: user?.id,
      });
      setError("Failed to start checkout. Please try again.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section with Value Proposition */}
      <Section
        contained={false}
        size="xl"
        surface="brand"
        className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 text-white"
      >
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.1))]" />
        <Container className="relative">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              {VALUE_PROPS.mainHeadline}
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
              {VALUE_PROPS.subHeadline}
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-8">
              {VALUE_PROPS.trustBadges.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2"
                >
                  <CheckCircle className="h-5 w-5 text-green-400" />
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
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        </Container>
      )}

      {/* Billing Toggle */}
      <Container className="mt-8 mb-10 relative z-10">
        <div className="flex justify-center">
          <div className="inline-flex items-center bg-white rounded-full shadow-lg p-1">
            <button
              onClick={() => billingInterval === "annual" && toggleBillingInterval()}
              className={cn(
                "px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200",
                billingInterval === "monthly"
                  ? "bg-blue-600 text-white"
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
                  ? "bg-blue-600 text-white"
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
        size="lg"
        surface="subtle"
        divider="both"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {SUBSCRIPTION_TIERS.map((tier) => (
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

        {/* One-Time Exam Packages Toggle */}
        <div className="mt-16 text-center">
          <button
            onClick={() => setShowExamPackages(!showExamPackages)}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
          >
            <span>Prefer a one-time purchase? View exam packages</span>
            {showExamPackages ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Exam Packages Section */}
        {showExamPackages && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {EXAM_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className="border border-gray-200 rounded-lg p-6 bg-white hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2">{pkg.duration}</h3>
                <div className="text-3xl font-bold text-gray-900 mb-4">${pkg.price}</div>
                <ul className="space-y-2 mb-6">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => pkg.priceId && handleCheckout(pkg.priceId, pkg.duration)}
                  disabled={!!loading || !pkg.priceId}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* AI Credits Explanation */}
      <Section size="lg" surface="subtle" divider="bottom">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">How AI Credits Work</h2>
            <p className="text-gray-600 dark:text-slate-300">
              AI credits power our adaptive learning engine. Use them for personalized practice
              exams and detailed explanations.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div
              className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <Zap className="mx-auto mb-3 h-10 w-10 text-blue-600 dark:text-sky-200" />
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">Full Practice Exam</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-sky-200">{AI_CREDIT_USAGE.fullExam} Credit</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">Complete 60-question adaptive exam</p>
            </div>
            <div
              className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <TrendingUp className="mx-auto mb-3 h-10 w-10 text-blue-600 dark:text-sky-200" />
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">Domain Quiz</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-sky-200">
                {AI_CREDIT_USAGE.domainQuiz} Credit
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">25-question focused practice</p>
            </div>
            <div
              className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <Award className="mx-auto mb-3 h-10 w-10 text-blue-600 dark:text-sky-200" />
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">AI Explanation</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-sky-200">
                {AI_CREDIT_USAGE.explanation} Credit
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">Detailed answer explanation</p>
            </div>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-slate-300 mt-6">
            Need more credits? Purchase additional at ${AI_CREDIT_USAGE.additionalCreditPrice}
            /credit or upgrade your plan
          </p>
        </div>
      </Section>

      {/* Social Proof Section */}
      <Section size="lg" surface="default">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Trusted by Cloud Professionals Worldwide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PRICING_TESTIMONIALS.map((testimonial, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                  <p className="text-sm text-blue-600 font-medium mt-1">
                    {testimonial.tier} Customer
                  </p>
                </div>
              </div>
            ))}
          </div>
      </Section>

      {/* Feature Comparison */}
      <Section size="lg" surface="subtle" divider="bottom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Compare Plans in Detail</h2>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
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
                    if (priceId) handleCheckout(priceId, tier.name);
                  }
                }}
              />
          )}
      </Section>

      {/* FAQ Section */}
      <Section size="lg" surface="default" divider="bottom">
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
        className="bg-gradient-to-r from-blue-600 to-cyan-600"
      >
        <Container className="max-w-4xl text-center text-white">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Pass Your Certification?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of professionals who achieved their certification goals with Testero
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              tone="accent"
              className="text-lg"
            >
              <Link href="/signup">Start Free Diagnostic</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              tone="accent"
              className="text-lg"
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
            <span>30-day money-back guarantee on all plans</span>
          </div>
        </Container>
      </Section>

      {/* Pricing Cards Anchor handled via Section id */}
    </div>
  );
}
