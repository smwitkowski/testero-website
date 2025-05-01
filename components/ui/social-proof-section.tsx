"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/design-system/colors';
import { duration, easing } from '@/lib/design-system/animations';

interface SocialProofCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  delay?: number;
}

const SocialProofCard: React.FC<SocialProofCardProps> = ({ 
  icon, 
  title, 
  subtitle,
  color,
  delay = 0
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn(
        "bg-white p-4 sm:p-6 rounded-lg shadow-md border border-slate-100",
        "transform transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1"
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
      <div className="flex flex-col items-center">
        <div 
          className={cn(
            "w-12 h-12 mb-4 rounded-full flex items-center justify-center transition-transform",
            isHovered ? "scale-110" : "scale-100"
          )}
          style={{ 
            backgroundColor: `${color}50`, // Lightened version of the color
            transition: `transform ${duration.fast}ms ${easing.spring}`
          }}
        >
          <div className="text-[color] transition-all" style={{ color }}>
            {icon}
          </div>
        </div>
        
        <h3 className={cn(
          "text-center transition-all duration-300",
          isHovered ? "text-3xl font-bold" : "text-2xl font-semibold", 
          title.length > 10 ? "text-lg" : "text-xl"
        )}>
          {title}
        </h3>
        
        <p className="text-slate-600 text-center">{subtitle}</p>
      </div>
    </div>
  );
};

// Animation for staggered card appearance
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

export function SocialProofSection() {
  return (
    <section className="w-full bg-slate-100 py-8 sm:py-12 md:py-20 px-4 sm:px-6 relative">
      {/* Add styles to head for animations */}
      <style jsx global>{fadeInUp}</style>
      
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 overflow-hidden">
        <div className="grid grid-cols-10 grid-rows-10 w-full h-full">
          {Array.from({ length: 100 }).map((_, i) => (
            <div key={i} className="border-b border-r border-slate-500"></div>
          ))}
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
        <h2 className={cn(
          "text-xl sm:text-2xl md:text-3xl font-semibold text-slate-700",
          "opacity-0"
        )}
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast}ms`
          }}
        >
          Join 1,200+ Cloud Pros Already Leveling Up with Testero
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-4">
          {/* Card 1: Waitlist Count */}
          <SocialProofCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
            title="1,200+ Cloud Pros"
            subtitle="Already on the Waitlist"
            color={colors.primary[400]}
            delay={duration.fast * 2}
          />
          
          {/* Card 2: Founder */}
          <SocialProofCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
            }
            title="Built by Insiders"
            subtitle="Ex-Google Cloud PSO Leadership"
            color={colors.feedback.success.base}
            delay={duration.fast * 3}
          />
          
          {/* Card 3: Featured */}
          <SocialProofCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            }
            title="Featured on"
            subtitle="Product Hunt Top Launch"
            color={colors.accent[400]}
            delay={duration.fast * 4}
          />
          
          {/* Card 4: Testimonial */}
          <SocialProofCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
            title="Real Results"
            subtitle='&quot;Cut my study time in half!&quot;'
            color={colors.accent[600]}
            delay={duration.fast * 5}
          />
        </div>
        
        {/* Additional Testimonial Row (Optional) */}
        <div 
          className="mt-8 sm:mt-12 bg-white rounded-xl p-4 sm:p-6 shadow-md border border-slate-200 max-w-2xl mx-auto opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 6}ms`
          }}
        >
          <blockquote className="text-base sm:text-lg italic text-slate-700">
            &quot;Testero&apos;s AI-powered practice questions helped me focus on what matters most. I felt more confident and passed my certification on the first try!&quot;
          </blockquote>
          <div className="mt-4 flex items-center justify-center">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 font-medium">JD</div>
            <div className="ml-3 text-left">
              <p className="font-medium">Jane Doe</p>
              <p className="text-sm text-slate-500">Senior Cloud Architect</p>
            </div>
          </div>
        </div>
        
        {/* Logos Section (Placeholder - Replace with actual partner logos when available) */}
        <div 
          className="mt-16 opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 7}ms`
          }}
        >
          <p className="text-sm uppercase tracking-wide text-slate-500 mb-6">Recognized by Leading Tech Communities</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 opacity-60">
            {/* These are placeholder grayscale logo elements - replace with actual partner logos */}
            <div className="w-24 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400">Logo 1</div>
            <div className="w-24 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400">Logo 2</div>
            <div className="w-24 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400">Logo 3</div>
          </div>
        </div>
      </div>
    </section>
  );
}
