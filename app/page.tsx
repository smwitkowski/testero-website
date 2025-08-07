"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import dynamic from "next/dynamic";
import Link from "next/link";
import { StaggeredText } from "@/components/marketing/effects/staggered-text";
import { BenefitsSectionSkeleton } from "@/components/marketing/sections/benefits-section";
import { LampContainer } from "@/components/marketing/effects/lamp-effect";
import { EnhancedSocialProof } from "@/components/marketing/sections/enhanced-social-proof";
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
  Users,
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
  const { ref: socialProofRef, shouldLoad: loadSocialProof } = useTrackSectionView("social_proof");
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
    <main className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-b from-slate-50 to-white">
      {/* Add JSON-LD structured data */}
      <JsonLd />

      {/* Hero Section with Enhanced Value Proposition */}
      <LampContainer>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <StaggeredText className="space-y-6" delay={0.2}>
            {/* Urgency Badge */}
            <div className="inline-flex items-center gap-2 bg-yellow-400/20 backdrop-blur-sm border border-yellow-400/40 rounded-full px-4 py-2 mb-4">
              <Zap className="h-4 w-4 text-yellow-300" />
              <span className="text-sm font-semibold text-yellow-100">
                Limited Time: Annual Plans 25% Off
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-white">
              <span className="block">Pass Your Cloud Certification</span>
              <span className="relative inline-block bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                15% Faster—Guaranteed
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"></span>
              </span>
            </h1>

            {/* Enhanced Sub-headline with Value Props */}
            <h2 className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
              Join 5,000+ professionals who passed on their first attempt. AI-powered practice that
              adapts to you. Updated within 14 days of exam changes.
            </h2>

            {/* Social Proof Stats */}
            <div className="flex flex-wrap justify-center gap-6 mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-white font-semibold">92% Pass Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                <span className="text-white font-semibold">5,000+ Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-400" />
                <span className="text-white font-semibold">40% Less Study Time</span>
              </div>
            </div>

            {/* Pricing Teaser */}
            <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 backdrop-blur-sm border border-blue-400/40 rounded-lg px-6 py-4 max-w-3xl mx-auto">
              <p className="text-lg md:text-xl text-white font-medium mb-2">
                Start your journey for as low as{" "}
                <span className="text-2xl font-bold text-yellow-300">$39/month</span>
              </p>
              <p className="text-sm text-blue-200">
                Free diagnostic test • 7-day money-back guarantee • Cancel anytime
              </p>
            </div>

            {/* Enhanced CTAs */}
            <div className="pt-6 w-full max-w-lg mx-auto">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  asChild
                  size="lg"
                  className="text-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  onClick={() => handlePricingClick("hero_primary")}
                >
                  <Link href="/pricing">
                    View Pricing Plans
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="text-lg">
                  <Link href="/diagnostic">Try Free Diagnostic</Link>
                </Button>
              </div>
              <p className="text-sm text-white/80 mt-4 text-center">
                ✓ No credit card required ✓ Instant access ✓ Cancel anytime
              </p>
            </div>
          </StaggeredText>
        </div>
      </LampContainer>

      {/* Main content sections */}
      <div role="main" id="main-content">
        {/* Value Anchors Section */}
        <section className="w-full py-16 px-4 sm:px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">ROI Guaranteed</h3>
                <p className="text-gray-600">
                  Invest $149 to protect your $300 exam fee. PMLE-certified professionals earn
                  $150k+ on average.
                </p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Save 40% Study Time</h3>
                <p className="text-gray-600">
                  AI-personalized learning paths adapt to your strengths and weaknesses, getting you
                  ready faster.
                </p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Pass Guarantee</h3>
                <p className="text-gray-600">
                  Complete 80% of your study plan and don&apos;t pass? Get 3 additional months free.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Social Proof Section */}
        <section ref={socialProofRef} aria-labelledby="social-proof-heading">
          {loadSocialProof ? <EnhancedSocialProof /> : null}
        </section>

        {/* Pricing Preview Section */}
        <section
          ref={pricingPreviewRef}
          className="w-full py-20 px-4 sm:px-6 bg-gradient-to-b from-blue-50 to-white"
        >
          {loadPricingPreview && (
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  Choose Your Path to Certification Success
                </h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Flexible plans designed for every learning journey. All plans include our
                  AI-powered adaptive learning engine.
                </p>
              </div>

              {/* Pricing Cards Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                {SUBSCRIPTION_TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    className={cn(
                      "relative rounded-xl p-6 bg-white border-2 transition-all",
                      tier.recommended
                        ? "border-blue-500 shadow-xl scale-105"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-lg"
                    )}
                  >
                    {tier.recommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          MOST POPULAR
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                      <div className="flex items-baseline justify-center">
                        <span className="text-4xl font-bold">${tier.monthlyPrice}</span>
                        <span className="text-gray-500 ml-2">/month</span>
                      </div>
                      <p className="text-sm text-green-600 font-medium mt-2">
                        Save {tier.savingsPercentage}% with annual billing
                      </p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {tier.highlighted?.slice(0, 3).map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      className={cn(
                        "w-full",
                        tier.recommended
                          ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                          : ""
                      )}
                      onClick={() => handlePricingClick(`preview_${tier.id}`)}
                    >
                      <Link href="/pricing">Get Started</Link>
                    </Button>
                  </div>
                ))}
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
                    "The Pro plan at $59/month paid for itself instantly. Passed PMLE with 89% on my first attempt after just 3 weeks. The adaptive learning saved me at least 40 hours of study time.",
                  author: "Alex Chen",
                  role: "ML Engineer → Senior ML Engineer (+$25K)",
                },
                {
                  id: "2",
                  quote:
                    "Started with the Basic plan for my PCA cert, then upgraded to All-Access. Passed 3 certifications in 6 months and got promoted. Best $749 I've ever invested in my career.",
                  author: "Sarah Martinez",
                  role: "DevOps Engineer → Cloud Architect",
                },
                {
                  id: "3",
                  quote:
                    "The 15-minute free diagnostic showed I was at 58% readiness. After 4 weeks on the Pro plan, I hit 91% and passed easily. Worth every penny for the peace of mind alone.",
                  author: "Michael Johnson",
                  role: "Passed 3 GCP Certs in 6 Months",
                },
              ]}
            />

            {/* Success Metrics */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600">92%</div>
                <div className="text-sm text-gray-600">First-Attempt Pass Rate</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">5,000+</div>
                <div className="text-sm text-gray-600">Professionals Certified</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600">4.8/5</div>
                <div className="text-sm text-gray-600">Average Rating</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600">40%</div>
                <div className="text-sm text-gray-600">Less Study Time</div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Credits Explainer */}
        <section className="w-full py-16 px-4 sm:px-6 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
              Powered by AI, Personalized for You
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6">
                <Zap className="h-10 w-10 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Adaptive Learning</h3>
                <p className="text-gray-600">
                  AI adjusts difficulty based on your performance, focusing on weak areas
                </p>
              </div>
              <div className="p-6">
                <Award className="h-10 w-10 text-green-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Exam-Ready Questions</h3>
                <p className="text-gray-600">
                  Questions harder than the real exam, making test day feel easy
                </p>
              </div>
              <div className="p-6">
                <TrendingUp className="h-10 w-10 text-purple-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Progress Analytics</h3>
                <p className="text-gray-600">
                  Know exactly when you&apos;re ready with our readiness score algorithm
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Final CTA Section */}
        <section
          ref={finalCtaRef}
          className="w-full py-20 bg-gradient-to-r from-blue-600 to-cyan-600"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Your Certification Journey Starts Today
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Don&apos;t let another exam cycle pass you by. Join 5,000+ successful professionals.
            </p>

            {/* Urgency Elements */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-4 mb-4">
                <Clock className="h-6 w-6 text-yellow-300" />
                <span className="text-lg font-semibold">Limited Time Offer</span>
              </div>
              <p className="text-blue-100 mb-4">
                Annual plans 25% off • Prices increase in 30 days
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">$39</div>
                  <div className="text-sm text-blue-200">Basic/month</div>
                </div>
                <div className="border-2 border-yellow-400 rounded-lg p-2">
                  <div className="text-2xl font-bold text-yellow-300">$59</div>
                  <div className="text-sm text-blue-200">Pro/month</div>
                  <div className="text-xs text-yellow-300">POPULAR</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">$79</div>
                  <div className="text-sm text-blue-200">All-Access</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="text-lg bg-white text-blue-600 hover:bg-gray-100"
                onClick={() => handlePricingClick("final_cta_primary")}
              >
                <Link href="/pricing">
                  See Pricing & Start Today
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-lg border-white text-white hover:bg-white/10"
              >
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
                <span>4.8/5 rating</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Related Content Links - Now with Pricing Focus */}
      <section className="w-full py-12 md:py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-8">
            Learn More About Our Platform
          </h2>
          <div className="flex flex-wrap justify-center gap-6">
            <Link
              href="/pricing"
              className="text-blue-600 hover:underline text-lg font-semibold"
              onClick={() => handlePricingClick("footer_link")}
            >
              View All Pricing Options →
            </Link>
            <Link
              href="/content/hub/google-cloud-certification-guide"
              className="text-blue-600 hover:underline text-lg"
            >
              Google Cloud Certification Guide
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
