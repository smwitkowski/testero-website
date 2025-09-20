"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { colorSemantic, duration, easing } from '@/lib/design-system';

interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
  highlightColor?: string;
  bgColor: string;
  iconColor: string;
  delay?: number;
}

const BenefitCard: React.FC<BenefitCardProps> = ({
  icon,
  title,
  description,
  highlight,
  highlightColor = colorSemantic.accent[500],
  bgColor,
  iconColor,
  delay = 0
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Replace highlight text with styled version if provided
  const processedDescription = highlight ? (
    <>
      {description.split(highlight).map((part, index, array) => (
        <React.Fragment key={index}>
          {part}
          {index < array.length - 1 && (
            <span className="font-semibold" style={{ color: highlightColor }}>
              {highlight}
            </span>
          )}
        </React.Fragment>
      ))}
    </>
  ) : (
    description
  );

  return (
    <article
      className={cn(
        "bg-white p-4 sm:p-6 rounded-xl shadow-md border border-slate-100",
        "transform transition-all duration-300",
        "hover:shadow-lg"
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'both',
        animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
        opacity: 0,
        transform: 'translateY(20px)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start space-x-4">
        <div 
          className={cn(
            "p-3 rounded-lg transition-transform",
            isHovered ? "scale-110" : "scale-100"
          )}
          style={{ 
            backgroundColor: bgColor,
            transition: `transform ${duration.fast}ms ${easing.spring}`
          }}
          aria-hidden="true"
        >
          <div className="transition-all" style={{ color: iconColor }}>
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <h3 className={cn(
            "text-lg font-semibold text-slate-800 mb-2 transition-all",
            isHovered && "text-accent-600"
          )}>
            {title}
          </h3>
          <p className="text-slate-600">{processedDescription}</p>
        </div>
      </div>
    </article>
  );
};

// Animation keyframes
const fadeInUp = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const slideInFromSide = `
  @keyframes slideInFromSide {
    from {
      opacity: 0;
      transform: translateX(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

const pulse = `
  @keyframes pulse {
    0% {
      opacity: 0.2;
      transform: scale(1);
    }
    50% {
      opacity: 0.3;
      transform: scale(1.05);
    }
    100% {
      opacity: 0.2;
      transform: scale(1);
    }
  }
`;

// Skeleton loader component for the benefits section
export function BenefitsSectionSkeleton() {
  return (
    <section className="w-full py-10 sm:py-16 md:py-24 px-4 sm:px-6 relative">
      {/* Background element */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute right-[6%] top-1/4 -translate-y-1/2 w-52 h-52 bg-blue-50 rounded-full opacity-30 blur-2xl"></div>
        <div className="absolute left-[6%] bottom-1/4 translate-y-1/2 w-52 h-52 bg-orange-50 rounded-full opacity-30 blur-2xl"></div>
      </div>
      
      <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
        {/* Skeleton heading */}
        <div className="h-12 bg-slate-200 rounded-lg w-3/4 mx-auto animate-pulse"></div>
        
        {/* Skeleton paragraph */}
        <div className="h-6 bg-slate-200 rounded-lg w-5/6 mx-auto animate-pulse"></div>
        
        {/* Skeleton cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-slate-100 animate-pulse">
              <div className="flex items-start space-x-4">
                <div className="p-3 rounded-lg bg-slate-200 h-12 w-12"></div>
                <div className="flex-1">
                  <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Skeleton comparison */}
        <div className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-200">
          <div className="flex flex-col md:flex-row justify-center items-center gap-8">
            <div className="flex-1">
              <div className="h-6 bg-slate-200 rounded w-1/2 mx-auto md:ml-auto md:mr-0 mb-4"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-4 bg-slate-200 rounded w-3/4 mx-auto md:ml-auto md:mr-0"></div>
                ))}
              </div>
            </div>
            
            <div className="hidden md:block h-40 border-l border-slate-300" aria-hidden="true"></div>
            
            <div className="flex-1">
              <div className="h-6 bg-slate-200 rounded w-1/2 mx-auto md:mr-auto md:ml-0 mb-4"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-4 bg-slate-200 rounded w-3/4 mx-auto md:mr-auto md:ml-0"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BenefitsSection() {
  return (
    <section className="w-full py-10 sm:py-16 md:py-24 px-4 sm:px-6 relative">
      {/* Add styles to head for animations */}
      <style jsx global>{`${fadeInUp} ${slideInFromSide} ${pulse}`}</style>

      {/* Background element */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute right-[6%] top-1/4 -translate-y-1/2 w-52 h-52 bg-blue-50 rounded-full opacity-30 blur-2xl"
          style={{
            animation: `pulse 15s ease-in-out infinite alternate`,
          }}
        ></div>
        <div
          className="absolute left-[6%] bottom-1/4 translate-y-1/2 w-52 h-52 bg-orange-50 rounded-full opacity-30 blur-2xl"
          style={{
            animation: `pulse 18s ease-in-out infinite alternate-reverse`,
          }}
        ></div>
      </div>
      
      <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
        <h2 
          id="benefits-heading"
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-slate-800 drop-shadow-sm opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast}ms`
          }}
        >
          Powerful Features to <span className="text-orange-500">Accelerate</span> Your Certification Journey
        </h2>
        
        <p 
          className="text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 2}ms`
          }}
        >
          Everything you need to master Google Cloud, AWS, and Azure certifications - available now, completely free to start:
        </p>
        
        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 text-left"
          role="list"
        >
          {/* Feature 1 - Smart Diagnostics */}
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            }
            title="Never Study Outdated Content"
            description="Automatically updated within 14 days of official blueprint changes—while competitors take months. Always practice with the latest exam topics."
            bgColor={colorSemantic.primary[50]}
            iconColor={colorSemantic.primary[500]}
            delay={duration.fast * 3}
          />
          
          {/* Feature 2 - Practice Questions */}
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            }
            title="Know Your Exact Readiness"
            description="15-minute diagnostic reveals your percentile score and exact gaps. No more guessing if you're ready—know with data-driven confidence."
            bgColor={colorSemantic.success.light}
            iconColor={colorSemantic.success.base}
            delay={duration.fast * 4}
          />
          
          {/* Feature 3 - Progress Tracking */}
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            }
            title="Study 40% More Efficiently"
            description="Adaptive engine eliminates redundant practice, focusing only on your weak areas. Save 40+ hours compared to traditional study methods."
            bgColor={colorSemantic.primary[100]}
            iconColor={colorSemantic.accent[500]}
            delay={duration.fast * 5}
          />
          
          {/* Feature 4 - Multi-Cloud Support */}
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
              </svg>
            }
            title="Pass With Confidence"
            description="Join the 85% who pass on their first attempt (industry average: 70%). Built by ex-Google Cloud PSO experts who know what it takes."
            bgColor={colorSemantic.accent[50]}
            iconColor={colorSemantic.accent[500]}
            delay={duration.fast * 6}
          />
        </div>
        
        {/* Feature availability and CTA */}
        <div 
          className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-200 opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 7}ms`
          }}
        >
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Ready to Get Started?</h3>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Join hundreds of cloud professionals already using Testero to accelerate their certification journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
              <Link href="/signup" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-4 rounded-lg text-lg font-semibold shadow-md transition-all hover:shadow-lg hover:scale-105 text-center">
                Start Free Practice
              </Link>
              <Link href="/diagnostic" className="bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 px-8 py-4 rounded-lg text-lg font-semibold shadow-md transition-all hover:shadow-lg text-center">
                Take Diagnostic Test
              </Link>
            </div>
            <p className="text-sm text-slate-500 mt-4">✓ Free forever tier ✓ No credit card required ✓ Instant access</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// For backward compatibility
export default BenefitsSection;
