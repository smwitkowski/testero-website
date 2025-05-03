"use client"; // Make this a client component

import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { usePostHog } from "posthog-js/react";
import { StaggeredText } from "@/components/ui/staggered-text";
import { BenefitsSection } from "@/components/ui/benefits-section";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { SocialProofSection } from "@/components/ui/social-proof-section";
import { FinalCtaSection } from "@/components/ui/final-cta-section";
import { JsonLd } from "./page.metadata";

// Helper hook for tracking section views
function useTrackSectionView(sectionName: string) {
  const posthog = usePostHog();
  const { ref, inView } = useInView({
    triggerOnce: true, // Only trigger once per section
    threshold: 0.1, // Trigger when 10% of the section is visible
  });

  useEffect(() => {
    if (inView && posthog) {
      posthog.capture('section_viewed', { section_name: sectionName });
    }
  }, [inView, sectionName, posthog]);

  return ref;
}

export default function Home() {
  const socialProofRef = useTrackSectionView("social_proof");
  const benefitsRef = useTrackSectionView("benefits");
  const finalCtaRef = useTrackSectionView("final_cta");

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Add JSON-LD structured data */}
      <JsonLd />
      {/* Hero Section */}
      <header className="w-full relative flex flex-col items-center justify-center p-4 sm:p-8 md:p-24 overflow-hidden" role="banner">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <div className="absolute top-10 left-1/4 w-64 h-64 rounded-full bg-blue-500 mix-blend-multiply blur-3xl"></div>
          <div className="absolute bottom-10 right-1/4 w-64 h-64 rounded-full bg-orange-500 mix-blend-multiply blur-3xl"></div>
        </div>
        
        <div className="z-10 max-w-5xl w-full flex flex-col items-center justify-center space-y-8">
          {/* Illustration */}
          <div className="mb-8 flex justify-center items-center relative">
            <div className="relative">
              <div className="absolute -top-12 -right-16 w-24 h-24 bg-blue-50 rounded-lg shadow-sm flex items-center justify-center transform rotate-12 border border-blue-100" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" className="opacity-70" aria-label="Cloud Platform" role="img">
                  <path d="M1.5 2.5h13v10a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1zM0 1h16v11.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 0 12.5zm3.75 4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5M7 4.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m1.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5" fill="#666" fillRule="evenodd"/>
                </svg>
              </div>
              <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-10 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center" aria-hidden="true">
                <svg width="80" height="80" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" className="opacity-80" aria-label="Certification" role="img">
                  <path d="M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45q-1.24.21-2.7.34-.31 1.83-.97 3.1M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.48-1.52a7 7 0 0 1-.96 0H7.5a4 4 0 0 1-.84-1.32q-.38-.89-.63-2.08a40 40 0 0 0 3.92 0q-.25 1.2-.63 2.08a4 4 0 0 1-.84 1.31zm2.94-4.76q1.66-.15 2.95-.43a7 7 0 0 0 0-2.58q-1.3-.27-2.95-.43a18 18 0 0 1 0 3.44m-1.27-3.54a17 17 0 0 1 0 3.64 39 39 0 0 1-4.3 0 17 17 0 0 1 0-3.64 39 39 0 0 1 4.3 0m1.1-1.17q1.45.13 2.69.34a6.5 6.5 0 0 0-3.67-3.44q.65 1.26.98 3.1M8.48 1.5l.01.02q.41.37.84 1.31.38.89.63 2.08a40 40 0 0 0-3.92 0q.25-1.2.63-2.08a4 4 0 0 1 .85-1.32 7 7 0 0 1 .96 0m-2.75.4a6.5 6.5 0 0 0-3.67 3.44 29 29 0 0 1 2.7-.34q.31-1.83.97-3.1M4.58 6.28q-1.66.16-2.95.43a7 7 0 0 0 0 2.58q1.3.27 2.95.43a18 18 0 0 1 0-3.44m.17 4.71q-1.45-.12-2.69-.34a6.5 6.5 0 0 0 3.67 3.44q-.65-1.27-.98-3.1" fill="#666" fillRule="evenodd"/>
                </svg>
              </div>
              <div className="absolute -bottom-10 -left-14 w-28 h-28 bg-orange-50 rounded-xl shadow-sm flex items-center justify-center transform -rotate-6 border border-orange-100" aria-hidden="true">
                <svg width="44" height="44" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" className="opacity-70" aria-label="Exam" role="img">
                  <path d="M14.5 13.5V5.41a1 1 0 0 0-.3-.7L9.8.29A1 1 0 0 0 9.08 0H1.5v13.5A2.5 2.5 0 0 0 4 16h8a2.5 2.5 0 0 0 2.5-2.5m-1.5 0v-7H8v-5H3v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1M9.5 5V2.12L12.38 5zM5.13 5h-.62v1.25h2.12V5zm-.62 3h7.12v1.25H4.5zm.62 3h-.62v1.25h7.12V11z" fill="#666" fillRule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>
          
          <StaggeredText className="text-center space-y-6" delay={0.2}>
            <h1 className="text-3xl sm:text-4xl md:text-7xl font-extrabold">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900">Ace Your Cloud Certification Exams</span>
              <br/>
              <span className="relative inline-block bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Confidently
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-600 rounded-full"></span>
              </span>
            </h1>
            
            {/* Sub-headline */}
            <h2 className="text-lg sm:text-xl md:text-2xl text-slate-700 max-w-3xl mx-auto leading-relaxed">
              Testero is the upcoming AI learning platform that generates always-current practice questions, builds your adaptive study plan, and predicts precisely when you&apos;re ready to ace Google Cloud, AWS, and Azure certification exams.
            </h2>

            {/* Offer Statement with highlight box */}
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-6 py-4 max-w-3xl mx-auto">
              <p className="text-lg md:text-xl text-orange-700 font-medium">
                Join the waitlist today for priority beta access (July 2025), lock in a <strong className="font-semibold bg-orange-100 px-2 py-1 rounded-md">30% lifetime Pro discount</strong>, and shape the future of Testero.
              </p>
            </div>
            
            {/* Above-the-Fold CTA with styled container */}
            <div className="pt-6 w-full max-w-md mx-auto">
              <div className="bg-white p-5 rounded-xl shadow-md border border-slate-100">
                <p className="text-sm text-slate-600 mb-3 font-medium" id="waitlist-form-label">Enter your email to join the waitlist:</p>
                <WaitlistForm buttonText="Reserve My Spot" ctaLocation="hero_section" aria-labelledby="waitlist-form-label" />
              </div>
              <p className="text-xs text-slate-500 mt-3 opacity-75">Join 1,200+ cloud pros already on the waitlist</p>
            </div>
          </StaggeredText>
        </div>
      </header>

      {/* Main content sections */}
      <div role="main" id="main-content">
        {/* Social Proof Section */}
        <section ref={socialProofRef} aria-labelledby="social-proof-heading">
          <SocialProofSection />
        </section>

        {/* Benefits Section */}
        <section ref={benefitsRef} aria-labelledby="benefits-heading">
          <BenefitsSection />
        </section>
        
        {/* Placeholder for Optional Teaser Features Section */}
        {/* <section className="w-full bg-slate-50 py-12 md:py-20 px-6"> ... </section> */}

        {/* Placeholder for Optional "Why Join Now?" Section */}
        {/* <section className="w-full py-12 md:py-20 px-6"> ... </section> */}

        {/* Final CTA Section */}
        <section ref={finalCtaRef} aria-labelledby="final-cta-heading">
          <FinalCtaSection />
        </section>
      </div>

      {/* === WAITLIST PAGE CONTENT END === */}

    </main>
  );
}
