"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/design-system/colors';
import { duration, easing } from '@/lib/design-system/animations';

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
  highlightColor = colors.accent[500],
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

export function BenefitsSection() {
  return (
    <section className="w-full py-10 sm:py-16 md:py-24 px-4 sm:px-6 relative">
      {/* Add styles to head for animations */}
      <style jsx global>{`${fadeInUp} ${slideInFromSide} ${pulse}`}</style>
      
      {/* Background element */}
      <div 
        className="absolute right-0 top-1/4 -translate-y-1/2 w-64 h-64 bg-blue-50 rounded-full opacity-20 blur-3xl"
        style={{
          animation: `pulse 15s ease-in-out infinite alternate`,
        }}
        aria-hidden="true"
      ></div>
      <div 
        className="absolute left-0 bottom-1/4 translate-y-1/2 w-64 h-64 bg-orange-50 rounded-full opacity-20 blur-3xl"
        style={{
          animation: `pulse 18s ease-in-out infinite alternate-reverse`,
        }}
        aria-hidden="true"
      ></div>
      
      <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
        <h2 
          id="benefits-heading"
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-slate-800 drop-shadow-sm opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast}ms`
          }}
        >
          Cloud Certification Success: <span className="text-orange-500">Smarter Prep. Less Stress.</span> Better Results.
        </h2>
        
        <p 
          className="text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 2}ms`
          }}
        >
          No more outdated PDFs or endless Q&A threads. Testero gives you a smarter, easier path to Google Cloud, AWS, and Azure certification success:
        </p>
        
        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 text-left"
          role="list"
        >
          {/* Benefit 1 */}
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
              </svg>
            }
            title="Personalized Cloud Certification Study"
            description="AI pinpoints your weak spots in Google Cloud, AWS, and Azure exams and builds a plan just for you. No wasted effort."
            bgColor={colors.primary[50]}
            iconColor={colors.primary[500]}
            delay={duration.fast * 3}
          />
          
          {/* Benefit 2 */}
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
            title="Master Cloud Certification Material 40% Faster"
            description="Adaptive, always-current questions help you learn what matters most for your cloud certification exam. Get results fast."
            highlight="40% Faster"
            highlightColor={colors.feedback.success.base}
            bgColor={colors.feedback.success.light}
            iconColor={colors.feedback.success.base}
            delay={duration.fast * 4}
          />
          
          {/* Benefit 3 */}
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
            }
            title="Know Exactly When You're Ready for Your Cloud Exam"
            description="Live dashboard predicts your pass date for Google Cloud, AWS, and Azure certification exams. Boost your pass rate by 15 points."
            highlight="15 points"
            highlightColor={colors.accent[500]}
            bgColor={colors.primary[100]}
            iconColor={colors.accent[500]}
            delay={duration.fast * 5}
          />
          
          {/* Benefit 4 */}
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
            }
            title="Always Up-to-Date Cloud Certification Content"
            description="Question bank refreshes within 14 days of any Google Cloud, AWS, or Azure exam change. Never study outdated certification material."
            highlight="14 days"
            highlightColor={colors.accent[500]}
            bgColor={colors.accent[50]}
            iconColor={colors.accent[500]}
            delay={duration.fast * 6}
          />
        </div>
        
        {/* Optional: Visual benefit comparison or graphic */}
        <div 
          className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-200 opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 7}ms`
          }}
        >
          <div className="flex flex-col md:flex-row justify-center items-center gap-8">
            <div className="flex-1 text-center md:text-right">
              <h3 className="text-lg sm:text-xl font-semibold text-red-500 mb-2" id="traditional-approach">Traditional Approach</h3>
              <ul className="list-none space-y-2" aria-labelledby="traditional-approach">
                <li className="flex items-center justify-end">
                  <span>Outdated study materials</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500 ml-2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </li>
                <li className="flex items-center justify-end">
                  <span>Generic study plans</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500 ml-2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </li>
                <li className="flex items-center justify-end">
                  <span>Uncertainty about readiness</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500 ml-2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </li>
              </ul>
            </div>
            
            <div className="hidden md:block h-40 border-l border-slate-300" aria-hidden="true"></div>
            
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg sm:text-xl font-semibold text-green-500 mb-2" id="testero-approach">Testero Approach</h3>
              <ul className="list-none space-y-2" aria-labelledby="testero-approach">
                <li className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-500 mr-2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>Always current, AI-generated content</span>
                </li>
                <li className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-500 mr-2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>Personalized weak-spot focusing</span>
                </li>
                <li className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-500 mr-2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>Predicted pass date with confidence</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// For backward compatibility
export default BenefitsSection;
