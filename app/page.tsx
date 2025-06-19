"use client"; // Make this a client component

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { usePostHog } from "posthog-js/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { StaggeredText } from "@/components/ui/staggered-text";
import { BenefitsSectionSkeleton } from "@/components/ui/benefits-section";
import { FinalCtaSection } from "@/components/ui/final-cta-section";
import { LampContainer } from "@/components/ui/lamp-effect";
import { EnhancedSocialProof } from "@/components/ui/enhanced-social-proof";
import { TestimonialCarousel } from "@/components/ui/testimonial-carousel";
import { Button } from "@/components/ui/button";
import { JsonLd } from "./page.metadata";

// Dynamically import the BenefitsSection component
const BenefitsSection = dynamic(
  () => import("@/components/ui/benefits-section").then((mod) => mod.BenefitsSection),
  { 
    loading: () => <BenefitsSectionSkeleton />,
    ssr: false // Disable server-side rendering for this component
  }
);

// Helper hook for tracking section views and lazy loading
function useTrackSectionView(sectionName: string, loadThreshold = 0.1) {
  const posthog = usePostHog();
  const [shouldLoad, setShouldLoad] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true, // Only trigger once per section
    threshold: loadThreshold, // Trigger when specified portion of the section is visible
    rootMargin: "200px 0px", // Start loading 200px before the element comes into view
  });

  useEffect(() => {
    if (inView) {
      // Track the view in PostHog
      if (posthog) {
        posthog.capture('section_viewed', { section_name: sectionName });
      }
      
      // Set the component to load
      setShouldLoad(true);
    }
  }, [inView, sectionName, posthog]);

  return { ref, shouldLoad, inView };
}

export default function Home() {
  const { ref: socialProofRef, shouldLoad: loadSocialProof } = useTrackSectionView("social_proof");
  const { ref: benefitsRef, shouldLoad: loadBenefits } = useTrackSectionView("benefits");
  const { ref: finalCtaRef } = useTrackSectionView("final_cta");

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-slate-50">
      {/* Add JSON-LD structured data */}
      <JsonLd />
      {/* Hero Section with Lamp Effect */}
      <LampContainer>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <StaggeredText className="space-y-6" delay={0.2}>
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-white">
              <span className="block">Master Cloud Certifications</span>
              <span className="relative inline-block bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                with AI-Powered Practice
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"></span>
              </span>
            </h1>
            
            {/* Sub-headline */}
            <h2 className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
              Get ready for Google Cloud, AWS, and Azure exams with personalized diagnostics, practice questions, and progress tracking.
            </h2>

            {/* Value Proposition with improved contrast */}
            <div className="bg-green-500/20 backdrop-blur-sm border border-green-400/40 rounded-lg px-6 py-4 max-w-3xl mx-auto">
              <p className="text-lg md:text-xl text-white font-medium">
                <strong className="font-semibold bg-green-400/30 px-2 py-1 rounded-md text-white">Free forever</strong> - No credit card required
              </p>
            </div>
            
            {/* Fixed CTAs with proper contrast */}
            <div className="pt-6 w-full max-w-lg mx-auto">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="text-lg">
                  <Link href="/signup">
                    Start Free Practice
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="text-lg">
                  <Link href="/diagnostic">
                    Take Diagnostic Test
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-white/80 mt-4 text-center">✓ Free account ✓ No credit card required ✓ Instant access</p>
            </div>
          </StaggeredText>
        </div>
      </LampContainer>

      {/* Main content sections */}
      <div role="main" id="main-content">
        {/* Enhanced Social Proof Section */}
        <section ref={socialProofRef} aria-labelledby="social-proof-heading">
          {loadSocialProof ? <EnhancedSocialProof /> : null}
        </section>

        {/* Benefits Section - Lazy loaded */}
        <section ref={benefitsRef} aria-labelledby="benefits-heading">
          {loadBenefits ? <BenefitsSection /> : <BenefitsSectionSkeleton />}
        </section>
        
        {/* Testimonials Section */}
        <section className="w-full py-10 sm:py-16 md:py-24 px-4 sm:px-6 bg-slate-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-8 sm:mb-12">
              What Cloud Professionals Say
            </h2>
            <TestimonialCarousel 
              testimonials={[
                {
                  id: "1",
                  quote: "The diagnostic test immediately showed me my weak areas in Google Cloud. The practice questions with detailed explanations helped me understand concepts I was struggling with. Great platform!",
                  author: "Alex Smith",
                  role: "Cloud Solutions Architect"
                },
                {
                  id: "2", 
                  quote: "Testero's AI-powered practice questions are incredibly realistic. I passed my Professional Cloud Architect exam on the first try thanks to the personalized study plan.",
                  author: "Sarah Chen",
                  role: "Senior DevOps Engineer"
                },
                {
                  id: "3",
                  quote: "The progress tracking and analytics helped me focus on my weak areas. The fact that it's built by ex-Google Cloud PSO experts really shows in the quality of content.",
                  author: "Michael Rodriguez", 
                  role: "Cloud Consultant"
                }
              ]}
            />
          </div>
        </section>

        {/* Final CTA Section */}
        <section ref={finalCtaRef} aria-labelledby="final-cta-heading">
          <FinalCtaSection />
        </section>
      </div>

      {/* Related Content Links */}
      <section className="w-full py-12 md:py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-8">Explore Related Content</h2>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/content/hub/google-cloud-certification-guide" className="text-blue-600 hover:underline text-lg">Google Cloud Certification Guide</Link>
            <Link href="/content/hub/google-data-analytics-professional-certificate-2025-guide" className="text-blue-600 hover:underline text-lg">Google Data Analytics Professional Certificate Guide</Link>
            <Link href="/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025" className="text-blue-600 hover:underline text-lg">Google Professional Machine Learning Engineer Certification Roadmap</Link>
            <Link href="/faq" className="text-blue-600 hover:underline text-lg">Frequently Asked Questions</Link>
          </div>
        </div>
      </section>

      {/* === WAITLIST PAGE CONTENT END === */}

    </main>
  );
}
