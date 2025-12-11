"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonFeature {
  name: string;
  free: boolean;
  paid: boolean;
}

const COMPARISON_FEATURES: ComparisonFeature[] = [
  {
    name: "One PMLE diagnostic test",
    free: true,
    paid: true,
  },
  {
    name: "Basic readiness summary",
    free: true,
    paid: true,
  },
  {
    name: "Full PMLE question bank (200+ questions)",
    free: false,
    paid: true,
  },
  {
    name: "Unlimited practice sessions",
    free: false,
    paid: true,
  },
  {
    name: "Limited practice (5 questions/week)",
    free: true,
    paid: false,
  },
  {
    name: "Detailed explanations for every answer",
    free: false,
    paid: true,
  },
  {
    name: "Domain-level readiness insights",
    free: false,
    paid: true,
  },
  {
    name: "Progress tracking",
    free: false,
    paid: true,
  },
];

export function FreeVsPaidComparison() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
          Free vs Paid: What&apos;s Included
        </h2>
        <p className="text-gray-600 dark:text-slate-300">
          See exactly what you get with free access versus a paid subscription
        </p>
      </div>

      {/* Desktop: Two-column layout */}
      <div className="hidden md:grid md:grid-cols-2 gap-6">
        {/* Free Column */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-6 text-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Free</h3>
            <p className="text-sm text-gray-600 dark:text-slate-300">No subscription required</p>
          </div>
          <ul className="space-y-4">
            {COMPARISON_FEATURES.map((feature) => (
              <li
                key={feature.name}
                className="flex items-start gap-3 text-sm"
              >
                {feature.free ? (
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" aria-hidden="true" />
                ) : (
                  <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "flex-1",
                    feature.free
                      ? "text-gray-900 dark:text-slate-100"
                      : "text-gray-400 dark:text-slate-500 line-through"
                  )}
                >
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Paid Column */}
        <div className="rounded-lg border-2 border-blue-600 bg-white p-6 shadow-lg dark:bg-slate-900 dark:border-blue-500">
          <div className="mb-6 text-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
              PMLE Prep (Paid)
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-300">Full access with subscription</p>
          </div>
          <ul className="space-y-4">
            {COMPARISON_FEATURES.map((feature) => (
              <li
                key={feature.name}
                className="flex items-start gap-3 text-sm"
              >
                {feature.paid ? (
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" aria-hidden="true" />
                ) : (
                  <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "flex-1",
                    feature.paid
                      ? "text-gray-900 dark:text-slate-100"
                      : "text-gray-400 dark:text-slate-500 line-through"
                  )}
                >
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile: Stacked cards */}
      <div className="md:hidden space-y-6">
        {/* Free Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-6 text-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Free</h3>
            <p className="text-sm text-gray-600 dark:text-slate-300">No subscription required</p>
          </div>
          <ul className="space-y-4">
            {COMPARISON_FEATURES.map((feature) => (
              <li
                key={feature.name}
                className="flex items-start gap-3 text-sm"
              >
                {feature.free ? (
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" aria-hidden="true" />
                ) : (
                  <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "flex-1",
                    feature.free
                      ? "text-gray-900 dark:text-slate-100"
                      : "text-gray-400 dark:text-slate-500 line-through"
                  )}
                >
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Paid Card */}
        <div className="rounded-lg border-2 border-blue-600 bg-white p-6 shadow-lg dark:bg-slate-900 dark:border-blue-500">
          <div className="mb-6 text-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
              PMLE Prep (Paid)
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-300">Full access with subscription</p>
          </div>
          <ul className="space-y-4">
            {COMPARISON_FEATURES.map((feature) => (
              <li
                key={feature.name}
                className="flex items-start gap-3 text-sm"
              >
                {feature.paid ? (
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" aria-hidden="true" />
                ) : (
                  <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "flex-1",
                    feature.paid
                      ? "text-gray-900 dark:text-slate-100"
                      : "text-gray-400 dark:text-slate-500 line-through"
                  )}
                >
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
