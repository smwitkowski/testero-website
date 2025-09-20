"use client";

import React from "react";
import { CheckCircle, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  tier: {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    annualPrice: number;
    monthlyPriceId?: string;
    annualPriceId?: string;
    aiCredits: number;
    features: string[];
    highlighted?: string[];
    recommended?: boolean;
    savingsPercentage?: number;
  };
  billingInterval: "monthly" | "annual";
  onCheckout: (priceId: string, tierName: string) => void;
  loading?: boolean;
  loadingId?: string | null;
}

export function PricingCard({
  tier,
  billingInterval,
  onCheckout,
  loading = false,
  loadingId = null,
}: PricingCardProps) {
  const price = billingInterval === "monthly" ? tier.monthlyPrice : tier.annualPrice;
  const priceId = billingInterval === "monthly" ? tier.monthlyPriceId : tier.annualPriceId;
  const isLoading = loading && loadingId === priceId;
  const monthlyEquivalent = billingInterval === "annual" ? Math.round(tier.annualPrice / 12) : null;

  return (
    <div
      data-recommended={tier.recommended ? "true" : undefined}
      className={cn(
        "relative box-border w-full max-w-full rounded-2xl border-2 bg-white p-8 shadow-lg transition-all duration-200",
        "motion-reduce:transition-none motion-reduce:transform-none",
        tier.recommended
          ? "border-blue-500 bg-gradient-to-b from-blue-50 via-white to-white pt-12 ring-2 ring-blue-500/20 shadow-xl md:shadow-2xl md:hover:shadow-2xl md:motion-safe:scale-105"
          : "border-gray-200 md:hover:border-gray-300 md:hover:shadow-xl",
        billingInterval === "annual" && tier.savingsPercentage ? "pt-12" : null
      )}
    >
      {/* Recommended Badge */}
      {tier.recommended && (
        <div className="absolute left-1/2 top-6 -translate-x-1/2">
          <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg">
            <Sparkles className="h-4 w-4" />
            MOST POPULAR
          </div>
        </div>
      )}

      {/* Savings Badge */}
      {billingInterval === "annual" && tier.savingsPercentage && (
        <div className="absolute right-6 top-6">
          <div className="rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow-md">
            SAVE {tier.savingsPercentage}%
          </div>
        </div>
      )}

      {/* Card Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
        <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        <div className="flex items-baseline">
          <span className="text-5xl font-bold tracking-tight text-gray-900">${price}</span>
          <span className="ml-2 text-lg text-gray-500">
            /{billingInterval === "monthly" ? "month" : "year"}
          </span>
        </div>
        {monthlyEquivalent && (
          <p className="mt-1 text-sm text-gray-600">That&apos;s only ${monthlyEquivalent}/month</p>
        )}
        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-600">
          <TrendingUp className="h-4 w-4" />
          {tier.aiCredits} AI credits included monthly
        </div>
      </div>

      {/* Highlighted Features */}
      {tier.highlighted && tier.highlighted.length > 0 && (
        <div className="mb-4 space-y-2 rounded-lg bg-blue-50 p-4">
          {tier.highlighted.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">{feature}</span>
            </div>
          ))}
        </div>
      )}

      {/* All Features */}
      <ul className="mb-8 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500 mt-0.5" />
            <span className="text-sm text-gray-600">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={() => priceId && onCheckout(priceId, tier.name)}
        disabled={isLoading || !priceId}
        className={cn(
          "w-full rounded-lg px-6 py-3 text-center font-semibold transition-all duration-200",
          "disabled:cursor-not-allowed disabled:opacity-50",
          tier.recommended
            ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-md hover:shadow-lg"
            : "bg-gray-900 text-white hover:bg-gray-800"
        )}
      >
        {isLoading ? (
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
        ) : (
          "Get Started"
        )}
      </button>

      {/* Trust indicator */}
      {tier.recommended && (
        <p className="mt-4 text-center text-xs text-gray-500">Chosen by 73% of our users</p>
      )}
    </div>
  );
}
