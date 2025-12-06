"use client";

import React from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { Button } from "@/components/ui/button";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface HeroSectionProps {
  // Add props if needed for future flexibility
}

const heroContent = {
  eyebrow: "AI-POWERED CERTIFICATION READINESS",
  headline: "Know if you're ready before you book your exam.",
  subheadline:
    "Testero uses realistic, blueprint-aligned questions to benchmark your readiness and show exactly where to focus.",
  primaryCta: {
    text: "Start free readiness check",
    href: "/diagnostic",
  },
  secondaryCta: {
    text: "View example questions",
    href: "/practice",
  },
  microcopy: "Takes 5–7 minutes · No credit card required",
};

// Readiness Dashboard Card Component
const ReadinessDashboardCard: React.FC = () => {
  return (
    <div className="rounded-xl lg:rounded-2xl border border-black/[0.06] lg:border-black/[0.08] bg-white p-4 sm:p-6 lg:p-8 shadow-md">
      <h3 className="text-lg font-medium text-slate-800 mb-4">Readiness Dashboard</h3>
      
      {/* Circular Progress Indicator */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-32 h-32">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-200"
            />
            {/* Progress circle (78%) */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - 0.78)}`}
              strokeLinecap="round"
              className="text-blue-600"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800">78%</div>
              <div className="text-xs text-slate-500">Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Breakdown */}
      <div>
        <h4 className="text-sm font-medium text-slate-800 mb-3">Domain Breakdown</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-md bg-blue-50">
            <span className="text-sm text-slate-700">Domain Content</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-blue-600 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-md">
            <span className="text-sm text-slate-700">Domain Developer</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-1/2 h-full bg-slate-400 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-md">
            <span className="text-sm text-slate-700">Domain Law</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-4/5 h-full bg-slate-400 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-md">
            <span className="text-sm text-slate-700">Domain Solutions</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-slate-400 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Example Question Card Component
const ExampleQuestionCard: React.FC = () => {
  return (
    <div className="rounded-xl lg:rounded-2xl border border-black/[0.06] lg:border-black/[0.08] bg-white p-4 sm:p-6 lg:p-8 shadow-lg w-full max-w-sm lg:max-w-sm">
      <h3 className="text-lg font-medium text-slate-800 mb-4">Example Question</h3>
      
      {/* Scenario Prompt */}
      <div className="mb-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          You are building a machine learning model to predict customer churn. You have a dataset with
          10,000 samples and 50 features. Which approach would be most appropriate for feature selection?
        </p>
      </div>

      {/* Checkbox Options */}
      <div className="space-y-3 mb-4">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked
            readOnly
            className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm text-slate-700 group-hover:text-slate-900">
            Use Principal Component Analysis (PCA) to reduce dimensionality
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            readOnly
            className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm text-slate-700 group-hover:text-slate-900">
            Use recursive feature elimination with cross-validation
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            readOnly
            className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm text-slate-700 group-hover:text-slate-900">
            Use all features and let the model learn automatically
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            readOnly
            className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm text-slate-700 group-hover:text-slate-900">
            Use correlation matrix to remove highly correlated features
          </span>
        </label>
      </div>

      {/* Explanation Button */}
      <Button variant="outline" tone="neutral" size="sm" className="w-full">
        Explanation
      </Button>
    </div>
  );
};

export const HeroSection: React.FC<HeroSectionProps> = () => {
  const posthog = usePostHog();

  const handlePrimaryCtaClick = () => {
    trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_STARTED, {
      source: "hero_cta",
      referrer: "homepage",
    });
  };

  return (
    // eslint-disable-next-line no-restricted-syntax
    <section className="w-full bg-slate-50 py-12 md:py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center lg:items-start">
          {/* Left Column: Text Content */}
          <div className="space-y-4 md:space-y-5 lg:space-y-6 text-center lg:text-left">
            {/* Eyebrow */}
            <span className="inline-block text-[0.6875rem] sm:text-xs font-medium tracking-wide uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
              {heroContent.eyebrow}
            </span>

            {/* Headline */}
            {/* eslint-disable-next-line design/no-tailwind-arbitrary-values */}
            <h1 className="text-[1.75rem] sm:text-[2rem] md:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight text-foreground">
              {heroContent.headline}
            </h1>

            {/* Subheadline */}
            <p className="text-[0.9375rem] md:text-base lg:text-lg font-normal text-muted-foreground max-w-[22.5rem] md:max-w-lg lg:max-w-2xl mx-auto lg:mx-0">
              {heroContent.subheadline}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center lg:justify-start">
              <Button
                asChild
                size="lg"
                tone="accent"
                variant="solid"
                className="w-full sm:w-auto min-h-[3rem] rounded-lg sm:rounded-xl"
                onClick={handlePrimaryCtaClick}
                aria-label="Start free readiness check to assess your exam readiness"
              >
                <Link href={heroContent.primaryCta.href}>
                  {heroContent.primaryCta.text}
                </Link>
              </Button>
              <Link
                href={heroContent.secondaryCta.href}
                className="inline-flex items-center justify-center min-h-[2.75rem] text-[color:var(--tone-accent)] hover:text-[color:var(--tone-accent)]/80 hover:underline font-medium text-base transition-colors"
              >
                {heroContent.secondaryCta.text}
              </Link>
            </div>

            {/* Microcopy */}
            <p className="text-[0.8125rem] sm:text-sm text-slate-500">{heroContent.microcopy}</p>
          </div>

          {/* Right Column: Product Mock */}
          <div className="relative mt-10 md:mt-8 lg:mt-0 w-full max-w-md mx-auto lg:max-w-none lg:mx-0">
            {/* Background Decorative Block - Hidden on mobile */}
            <div
              className="hidden lg:block absolute right-0 top-0 bottom-0 w-3/4 bg-slate-100 rounded-l-3xl -z-10"
              aria-hidden="true"
            />

            {/* Product Mock Cards */}
            <div
              role="img"
              aria-label="Readiness dashboard and example exam question preview showing Testero's question format."
              className="relative"
            >
              {/* Mobile: Stacked with transforms, Desktop: Absolute overlay */}
              <div className="relative">
                {/* Dashboard card - base layer */}
                <div className="relative z-0 transform lg:transform-none translate-y-8 lg:translate-y-0 scale-95 lg:scale-100">
                  <ReadinessDashboardCard />
                </div>

                {/* Question card - overlay */}
                <div className="relative lg:absolute lg:top-16 lg:right-0 lg:-right-4 z-10 -mt-16 lg:mt-0 mx-4 lg:mx-0">
                  <ExampleQuestionCard />
                </div>
              </div>

              {/* Decorative Diamond Shape */}
              <div
                className="absolute -bottom-4 -right-4 w-16 h-16 opacity-10"
                aria-hidden="true"
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <path
                    d="M50 0 L100 50 L50 100 L0 50 Z"
                    fill="currentColor"
                    className="text-slate-400"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
