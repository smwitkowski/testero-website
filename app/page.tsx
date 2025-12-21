"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BenefitsSectionSkeleton } from "@/components/marketing/sections/benefits-section";
import { HeroSection } from "@/components/marketing/sections/hero-section";
import { Button } from "@/components/ui/button";
import { JsonLd } from "./page.metadata";
import {
  CheckCircle,
  TrendingUp,
  Clock,
  Shield,
  Star,
  Zap,
  ArrowRight,
  Award,
} from "lucide-react";
import { SUBSCRIPTION_TIERS } from "@/lib/pricing/constants";
import { cn } from "@/lib/utils";
import { VALUE_PILLARS } from "@/lib/copy/message-house";

// Dynamically import the BenefitsSection component
const BenefitsSection = dynamic(
  () =>
    import("@/components/marketing/sections/benefits-section").then((mod) => mod.BenefitsSection),
  {
    loading: () => <BenefitsSectionSkeleton />,
    ssr: false,
  }
);

// Helper hook for tracking section views and lazy loading
function useTrackSectionView(sectionName: string, loadThreshold = 0.1) {
  const posthog = usePostHog();
  const [shouldLoad, setShouldLoad] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: loadThreshold,
    rootMargin: "200px 0px",
  });

  useEffect(() => {
    if (inView) {
      if (posthog) {
        trackEvent(posthog, ANALYTICS_EVENTS.FEATURE_DISCOVERED, {
          feature_name: sectionName,
          discovery_type: "scroll_view",
        });
      }
      setShouldLoad(true);
    }
  }, [inView, sectionName, posthog]);

  return { ref, shouldLoad, inView };
}

export default function Home() {
  const { ref: benefitsRef, shouldLoad: loadBenefits } = useTrackSectionView("benefits");
  const { ref: pricingPreviewRef, shouldLoad: loadPricingPreview } =
    useTrackSectionView("pricing_preview");
  const { ref: finalCtaRef } = useTrackSectionView("final_cta");
  const posthog = usePostHog();

  const handlePricingClick = (source: string) => {
    trackEvent(posthog, ANALYTICS_EVENTS.PRICING_PAGE_VIEWED, {
      source: `homepage_${source}`,
      referrer: "homepage",
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-stretch justify-start bg-gradient-to-b from-slate-50 to-white">
      {/* Add JSON-LD structured data */}
      <JsonLd />

      {/* Hero Section */}
      <HeroSection />

      {/* Main content sections */}
      <div role="main" id="main-content" className="w-full overflow-x-hidden">
        {/* Value Anchors Section */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <section className="w-full py-16 px-4 sm:px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xl text-gray-700 font-medium">
                Built for serious candidates who want signal, not noise.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="bg-[color:var(--tone-accent-surface)] rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-[color:var(--tone-accent)]" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Stop wasting study time on the wrong topics.</h3>
              </div>
              <div className="text-center">
                <div className="bg-[color:var(--tone-accent-surface)] rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-[color:var(--tone-accent)]" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Know your readiness before you pay the exam fee.</h3>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Preview Section */}
        <section
          ref={pricingPreviewRef}
          // eslint-disable-next-line no-restricted-syntax
          className="w-full py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-[color:var(--tone-accent-surface)]/20 to-white"
        >
          {loadPricingPreview && (
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  Start Free. Upgrade When Ready.
                </h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Take a diagnostic, see your weak areas, and get focused practice with explanations.
                </p>
              </div>

              {/* Pricing Cards Preview */}
              <div className="flex justify-center mb-12">
                <div className="w-full max-w-md">
                {SUBSCRIPTION_TIERS.filter((tier) => !tier.isHidden).map((tier) => (
                  <div
                    key={tier.id}
                    className={cn(
                      "relative rounded-2xl p-5 sm:p-6 bg-white border-2 transition-all",
                      tier.recommended
                        ? "border-[color:var(--tone-accent)] shadow-xl md:scale-105"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-lg"
                    )}
                  >

                    <div className="text-center mb-6 space-y-2">
                      <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                      <div className="flex items-baseline justify-center">
                        <span className="text-3xl sm:text-4xl font-bold">${tier.monthlyPrice}</span>
                        <span className="text-sm text-gray-500 ml-2">/month</span>
                      </div>
                      <p className="text-sm sm:text-base text-green-600 font-medium">
                        Save {tier.savingsPercentage}% with annual billing
                      </p>
                    </div>

                    <ul className="space-y-3 mb-6 text-left">
                      {tier.highlighted?.slice(0, 3).map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-[color:var(--tone-success)] flex-shrink-0" />
                          <span className="text-sm sm:text-base text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      size="md"
                      fullWidth
                      tone={tier.recommended ? "accent" : "neutral"}
                      variant={tier.recommended ? "solid" : "outline"}
                      className="text-base font-semibold h-12"
                      onClick={() => handlePricingClick(`preview_${tier.id}`)}
                    >
                      <Link href="/pricing">Start Preparing</Link>
                    </Button>
                  </div>
                ))}
                </div>
              </div>

              <div className="text-center">
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 text-[color:var(--tone-accent)] hover:text-[color:var(--tone-accent)]/80 font-semibold text-lg"
                  onClick={() => handlePricingClick("preview_compare")}
                >
                  Compare all features
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Benefits Section - Lazy loaded */}
        <section ref={benefitsRef} aria-labelledby="benefits-heading">
          {loadBenefits ? <BenefitsSection /> : <BenefitsSectionSkeleton />}
        </section>


        {/* Practice Explainer */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <section className="w-full py-16 px-4 sm:px-6 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6">
                <TrendingUp className="h-10 w-10 text-[color:var(--tone-accent)] mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">{VALUE_PILLARS.readiness.title}</h3>
                <p className="text-gray-600">
                  {VALUE_PILLARS.readiness.description}
                </p>
              </div>
              <div className="p-6">
                <Award className="h-10 w-10 text-[color:var(--tone-accent)] mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">{VALUE_PILLARS.blueprint.title}</h3>
                <p className="text-gray-600">
                  {VALUE_PILLARS.blueprint.description}
                </p>
              </div>
              <div className="p-6">
                <Zap className="h-10 w-10 text-[color:var(--tone-accent)] mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">{VALUE_PILLARS.explanations.title}</h3>
                <p className="text-gray-600">
                  {VALUE_PILLARS.explanations.description}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Final CTA Section */}
        <section
          ref={finalCtaRef}
          // eslint-disable-next-line no-restricted-syntax
          className="w-full py-20 bg-gradient-to-r from-[color:var(--tone-accent)] via-[color:var(--tone-accent)]/90 to-[color:var(--tone-accent)]/80"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Know When You&apos;re Ready
            </h2>
            <p className="text-xl mb-8 text-white/90">
              Start without an account. Create a free account to view and save results. Paid unlocks explanations and more practice.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                tone="accent"
                className="text-lg"
                onClick={() => handlePricingClick("final_cta_primary")}
              >
                <Link href="/diagnostic">Start Free Diagnostic</Link>
              </Button>
              <Button asChild variant="outline" tone="neutral" size="lg" className="text-lg">
                <Link href="/pricing">See Pricing</Link>
              </Button>
            </div>

            {/* Trust Signals */}
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[color:var(--tone-success)]" />
                <span>7-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-[color:var(--tone-success)]" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <span>Blueprint-aligned</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Related Content Links - Now with Pricing Focus */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <section className="w-full py-12 md:py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-8">
            PMLE Resources & Study Guides
          </h2>
          <div className="flex flex-wrap justify-center gap-6">
            <Link
              href="/pricing"
              className="text-[color:var(--tone-accent)] hover:underline text-lg font-semibold"
              onClick={() => handlePricingClick("footer_link")}
            >
                  View Pricing →
            </Link>
            <Link
              href="/content/hub/pmle-exam-study-guide"
              className="text-[color:var(--tone-accent)] hover:underline text-lg"
            >
              Complete PMLE Study Guide 2025
            </Link>
            <Link
              href="/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025"
              className="text-[color:var(--tone-accent)] hover:underline text-lg"
            >
              PMLE Certification Roadmap
            </Link>
            <Link href="/faq" className="text-[color:var(--tone-accent)] hover:underline text-lg">
              Frequently Asked Questions
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

