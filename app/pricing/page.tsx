"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { CheckCircle } from "lucide-react";
import { usePostHog } from "posthog-js/react";

interface PricingPlan {
  name: string;
  price: {
    monthly: number;
    yearly: number;
  };
  priceId: {
    monthly: string;
    yearly: string;
  };
  features: string[];
  recommended?: boolean;
}

const plans: PricingPlan[] = [
  {
    name: "Monthly",
    price: {
      monthly: 29,
      yearly: 290,
    },
    priceId: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY!,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY!,
    },
    features: [
      "Unlimited practice questions",
      "Full diagnostic assessments",
      "Personalized study plans",
      "Performance analytics",
      "Email support",
    ],
  },
  {
    name: "Yearly",
    price: {
      monthly: 24,
      yearly: 290,
    },
    priceId: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY!,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY!,
    },
    features: [
      "Everything in Monthly",
      "Save 17% annually",
      "Priority support",
      "Early access to new features",
      "Exclusive study resources",
    ],
    recommended: true,
  },
];

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const posthog = usePostHog();

  const handleCheckout = async (priceId: string, planName: string) => {
    try {
      // Track checkout intent
      posthog?.capture("checkout_initiated", {
        plan_name: planName,
        billing_interval: billingInterval,
        price_id: priceId,
      });

      // Require authentication
      if (!user) {
        posthog?.capture("checkout_redirect_to_signup", {
          plan_name: planName,
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Track successful checkout session creation
      posthog?.capture("checkout_session_created", {
        plan_name: planName,
        billing_interval: billingInterval,
      });

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      posthog?.capture("checkout_error", {
        error: error instanceof Error ? error.message : "Unknown error",
        plan_name: planName,
      });
      setError("Failed to start checkout. Please try again.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 max-w-2xl mx-auto">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600 mb-8">Choose the plan that works best for you</p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center space-x-4">
            <span
              className={`text-lg ${
                billingInterval === "monthly" ? "text-gray-900 font-semibold" : "text-gray-500"
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() =>
                setBillingInterval(billingInterval === "monthly" ? "yearly" : "monthly")
              }
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Toggle billing interval"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingInterval === "yearly" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-lg ${
                billingInterval === "yearly" ? "text-gray-900 font-semibold" : "text-gray-500"
              }`}
            >
              Yearly
              <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                Save 17%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          {plans.map((plan) => {
            const price = billingInterval === "monthly" ? plan.price.monthly : plan.price.yearly;
            const priceId =
              billingInterval === "monthly" ? plan.priceId.monthly : plan.priceId.yearly;
            const isRecommended = plan.recommended;

            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border ${
                  isRecommended ? "border-blue-500 shadow-xl" : "border-gray-200 shadow-lg"
                } bg-white p-8`}
              >
                {isRecommended && (
                  <div className="absolute -top-5 left-0 right-0 mx-auto w-32 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-2 text-center text-sm font-medium text-white">
                    RECOMMENDED
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-5xl font-bold tracking-tight text-gray-900">
                      ${price}
                    </span>
                    <span className="ml-2 text-lg text-gray-500">
                      /{billingInterval === "monthly" ? "month" : "year"}
                    </span>
                  </div>
                  {billingInterval === "yearly" && plan.name === "Yearly" && (
                    <p className="mt-2 text-sm text-gray-600">
                      That&apos;s only ${Math.round(price / 12)}/month
                    </p>
                  )}
                </div>

                <ul className="mb-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <CheckCircle className="h-6 w-6 flex-shrink-0 text-green-500" />
                      <span className="ml-3 text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(priceId, plan.name)}
                  disabled={loading !== null || authLoading}
                  className={`w-full rounded-lg px-6 py-3 text-center text-lg font-semibold transition-colors ${
                    isRecommended
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === priceId ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </span>
                  ) : user ? (
                    "Get Started"
                  ) : (
                    "Sign Up to Subscribe"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto text-left">
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I cancel my subscription anytime?
              </h3>
              <p className="text-gray-600">
                Yes, you can cancel your subscription at any time. You&apos;ll continue to have
                access until the end of your current billing period.
              </p>
            </div>
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Do you offer refunds?</h3>
              <p className="text-gray-600">
                We offer a 7-day money-back guarantee. If you&apos;re not satisfied, contact us
                within 7 days of your purchase for a full refund.
              </p>
            </div>
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Can I switch between plans?</h3>
              <p className="text-gray-600">
                Yes, you can upgrade or downgrade your plan at any time from your billing dashboard.
                Changes will be prorated.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
