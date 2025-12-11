"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BenefitsSectionSkeleton } from "@/components/marketing/sections/benefits-section";
import { HeroSection } from "@/components/marketing/sections/hero-section";
import { TestimonialCarousel } from "@/components/marketing/sections/testimonial-carousel";
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Protect Your $200 Exam Fee</h3>
                <p className="text-gray-600">
                  70% of PMLE test-takers fail and lose $200. Our diagnostic shows your exact 
                  readiness level before you book.
                </p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">October 2024 Exam Updated</h3>
                <p className="text-gray-600">
                  Google changed 30% of PMLE topics in October. Our questions are updated within 
                  14 days of any exam changes.
                </p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">7-Day Money-Back Guarantee</h3>
                <p className="text-gray-600">
                  Try Testero risk-free. If you&apos;re not satisfied within 7 days, get a full refund—no questions asked.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Preview Section */}
        <section
          ref={pricingPreviewRef}
          // eslint-disable-next-line no-restricted-syntax
          className="w-full py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-blue-50 to-white"
        >
          {loadPricingPreview && (
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  Choose Your PMLE Readiness Plan
                </h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Everything you need to pass PMLE — unlimited practice, personalized diagnostics, and expert-level explanations.
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
                        ? "border-blue-500 shadow-xl md:scale-105"
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
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
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
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-lg"
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

        {/* Enhanced Testimonials Section with Pricing Context */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <section className="w-full py-10 sm:py-16 md:py-24 px-4 sm:px-6 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                Real Success Stories from Our Students
              </h2>
              <p className="text-lg text-gray-600">
                See how professionals like you achieved their certification goals
              </p>
            </div>

            <TestimonialCarousel
              testimonials={[
                {
                  id: "1",
                  quote:
                    "Failed PMLE twice before finding Testero. The diagnostic showed I was only 58% ready. After 30 days of focused practice, I passed with 89%. Worth every penny.",
                  author: "Alex Chen",
                  role: "ML Engineer at Google",
                },
                {
                  id: "2",
                  quote:
                    "The October 2024 exam changes caught me off guard. Testero had updated questions within days. Their AI explanations for ML concepts are better than any course I've taken.",
                  author: "Sarah Martinez",
                  role: "Senior Data Scientist",
                },
                {
                  id: "3",
                  quote:
                    "PMLE is brutal—70% fail rate for a reason. Testero's diagnostic saved me from wasting $200. Studied for 30 days, passed first try. The money-back guarantee gave me confidence.",
                  author: "Michael Johnson",
                  role: "Cloud ML Engineer",
                },
              ]}
            />

            {/* Success Metrics */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600">70%</div>
                <div className="text-sm text-gray-600">PMLE Fail Rate</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">$200</div>
                <div className="text-sm text-gray-600">Exam Cost at Risk</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600">30</div>
                <div className="text-sm text-gray-600">Days to Pass</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600">Oct 2024</div>
                <div className="text-sm text-gray-600">Content Updated</div>
              </div>
            </div>
          </div>
        </section>

        {/* Practice Explainer */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <section className="w-full py-16 px-4 sm:px-6 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
              PMLE-Specific AI Training System
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6">
                <Zap className="h-10 w-10 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">ML Concept Mastery</h3>
                <p className="text-gray-600">
                  Deep coverage of TensorFlow, Vertex AI, BigQuery ML, and MLOps practices
                </p>
              </div>
              <div className="p-6">
                <Award className="h-10 w-10 text-green-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">October 2024 Updates</h3>
                <p className="text-gray-600">
                  500+ questions covering new Gemini, GenAI, and Vertex AI features
                </p>
              </div>
              <div className="p-6">
                <TrendingUp className="h-10 w-10 text-purple-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Readiness Score</h3>
                <p className="text-gray-600">
                  Know your exact PMLE readiness percentage before booking your $200 exam
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Final CTA Section */}
        <section
          ref={finalCtaRef}
          // eslint-disable-next-line no-restricted-syntax
          className="w-full py-20 bg-gradient-to-r from-blue-600 to-cyan-600"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Pass PMLE in 30 Days—Guaranteed
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Don&apos;t waste $200 on a failed attempt. Start with our free diagnostic to know exactly where you stand.
            </p>

            {/* Urgency Elements */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-4 mb-4">
                <Clock className="h-6 w-6 text-yellow-300" />
                <span className="text-lg font-semibold">Limited Time Offer</span>
              </div>
              <p className="text-blue-100 mb-4">
                New in 2025 • 7-day money-back guarantee • Cancel anytime
              </p>
              <div className="text-center">
                <div className="text-2xl font-bold">$39</div>
                <div className="text-sm text-blue-200">PMLE Readiness/month</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                tone="accent"
                className="text-lg"
                iconRight={<ArrowRight className="h-5 w-5" />}
                onClick={() => handlePricingClick("final_cta_primary")}
              >
                <Link href="/pricing">See Pricing & Start Today</Link>
              </Button>
              <Button asChild variant="outline" tone="neutral" size="lg" className="text-lg">
                <Link href="/diagnostic">Take Free Diagnostic First</Link>
              </Button>
            </div>

            {/* Trust Signals */}
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-400" />
                <span>7-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <span>PMLE-focused</span>
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
              className="text-blue-600 hover:underline text-lg font-semibold"
              onClick={() => handlePricingClick("footer_link")}
            >
                  View Pricing →
            </Link>
            <Link
              href="/content/hub/pmle-exam-study-guide"
              className="text-blue-600 hover:underline text-lg"
            >
              Complete PMLE Study Guide 2025
            </Link>
            <Link
              href="/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025"
              className="text-blue-600 hover:underline text-lg"
            >
              PMLE Certification Roadmap
            </Link>
            <Link href="/faq" className="text-blue-600 hover:underline text-lg">
              Frequently Asked Questions
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
