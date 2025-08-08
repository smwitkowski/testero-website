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
import { PricingCard } from "@/components/pricing/PricingCard";
import { ComparisonTable } from "@/components/pricing/ComparisonTable";
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
      // Track checkout intent
      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_INITIATED, {
        plan_name: planName,
        billing_interval: billingInterval,
        price_id: priceId,
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
        billing_interval: billingInterval,
        user_id: user?.id,
      });

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      trackEvent(posthog, ANALYTICS_EVENTS.CHECKOUT_ERROR, {
        error: error instanceof Error ? error.message : "Unknown error",
        plan_name: planName,
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
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 text-white">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.1))]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
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
            <div className="flex flex-wrap justify-center gap-6 text-sm sm:text-base">
              {VALUE_PROPS.guarantees.map((guarantee) => (
                <div key={guarantee} className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-yellow-400" />
                  <span>{guarantee}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
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
                <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  SAVE 25%
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
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
      </div>

      {/* AI Credits Explanation */}
      <div className="bg-blue-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">How AI Credits Work</h2>
            <p className="text-gray-600">
              AI credits power our adaptive learning engine. Use them for personalized practice
              exams and detailed explanations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 text-center">
              <Zap className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Full Practice Exam</h3>
              <p className="text-2xl font-bold text-blue-600">{AI_CREDIT_USAGE.fullExam} Credit</p>
              <p className="text-sm text-gray-600 mt-2">Complete 60-question adaptive exam</p>
            </div>
            <div className="bg-white rounded-lg p-6 text-center">
              <TrendingUp className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Domain Quiz</h3>
              <p className="text-2xl font-bold text-blue-600">
                {AI_CREDIT_USAGE.domainQuiz} Credit
              </p>
              <p className="text-sm text-gray-600 mt-2">25-question focused practice</p>
            </div>
            <div className="bg-white rounded-lg p-6 text-center">
              <Award className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">AI Explanation</h3>
              <p className="text-2xl font-bold text-blue-600">
                {AI_CREDIT_USAGE.explanation} Credit
              </p>
              <p className="text-sm text-gray-600 mt-2">Detailed answer explanation</p>
            </div>
          </div>
          <p className="text-center text-sm text-gray-600 mt-6">
            Need more credits? Purchase additional at ${AI_CREDIT_USAGE.additionalCreditPrice}
            /credit or upgrade your plan
          </p>
        </div>
      </div>

      {/* Social Proof Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
      </div>

      {/* Final CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Pass Your Certification?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of professionals who achieved their certification goals with Testero
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push("/signup")}
              className="px-8 py-4 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Start Free Diagnostic
            </button>
            <button
              onClick={() => {
                const element = document.getElementById("pricing-cards");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-8 py-4 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800 transition-colors"
            >
              View Pricing Plans
            </button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-white">
            <RefreshCw className="h-5 w-5" />
            <span>30-day money-back guarantee on all plans</span>
          </div>
        </div>
      </div>

      {/* Pricing Cards Anchor */}
      <div id="pricing-cards" className="absolute -top-20"></div>
    </div>
  );
}
