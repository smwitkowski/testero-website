"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { duration, easing } from '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { Sparkles, BarChart3, Cloud } from 'lucide-react';
import { SCOPE_CLAIMS, VALUE_PILLARS } from "@/lib/copy/message-house";

type BenefitTone = 'accent' | 'success' | 'info' | 'primary';

const toneStyles: Record<BenefitTone, { icon: string; highlight: string }> = {
  accent: {
    icon: 'bg-[color:var(--tone-accent-surface)] text-[color:var(--tone-accent)]',
    highlight: 'text-[color:var(--tone-accent)]',
  },
  success: {
    icon: 'bg-[color:var(--tone-success-surface)] text-[color:var(--tone-success)]',
    highlight: 'text-[color:var(--tone-success)]',
  },
  info: {
    icon: 'bg-[color:var(--tone-info-surface)] text-[color:var(--tone-info)]',
    highlight: 'text-[color:var(--tone-info)]',
  },
  primary: {
    icon: 'bg-[color:var(--surface-muted)] text-foreground',
    highlight: 'text-foreground',
  },
};

interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
  tone: BenefitTone;
  delay?: number;
}

const BenefitCard: React.FC<BenefitCardProps> = ({
  icon,
  title,
  description,
  highlight,
  tone,
  delay = 0
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const toneClass = toneStyles[tone];

  // Replace highlight text with styled version if provided
  const processedDescription = highlight ? (
    <>
      {description.split(highlight).map((part, index, array) => (
        <React.Fragment key={index}>
          {part}
          {index < array.length - 1 && (
            <span className={cn('font-semibold', toneClass.highlight)}>
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
        'rounded-xl border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-4 md:p-6 shadow-md',
        'transform transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-lg'
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
            'p-3 rounded-lg transition-transform',
            isHovered ? 'scale-110' : 'scale-100',
            toneClass.icon
          )}
          aria-hidden="true"
        >
          <div className="transition-all">{icon}</div>
        </div>
        <div className="flex-1">
          <h3 className={cn(
            'mb-2 text-lg font-semibold text-foreground transition-all',
            isHovered && toneClass.highlight
          )}>
            {title}
          </h3>
          <p className="text-muted-foreground">{processedDescription}</p>
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
    // eslint-disable-next-line no-restricted-syntax
    <section className="w-full py-10 sm:py-16 md:py-24 px-4 sm:px-6 relative">
      {/* Background element */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute right-[6%] top-1/4 -translate-y-1/2 h-52 w-52 rounded-full bg-[color:var(--tone-info-surface)] opacity-30 blur-2xl"></div>
        <div className="absolute left-[6%] bottom-1/4 translate-y-1/2 h-52 w-52 rounded-full bg-[color:var(--tone-accent-surface)] opacity-30 blur-2xl"></div>
      </div>

      <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
        {/* Skeleton heading */}
        <div className="mx-auto h-12 w-3/4 animate-pulse rounded-lg bg-[color:var(--surface-muted)]"></div>

        {/* Skeleton paragraph */}
        <div className="mx-auto h-6 w-5/6 animate-pulse rounded-lg bg-[color:var(--surface-muted)]"></div>

        {/* Skeleton cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="animate-pulse rounded-xl border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-4 md:p-6 shadow-md">
              <div className="flex items-start space-x-4">
                <div className="h-12 w-12 rounded-lg bg-[color:var(--surface-muted)] p-3"></div>
                <div className="flex-1">
                  <div className="mb-3 h-6 w-3/4 rounded bg-[color:var(--surface-muted)]"></div>
                  <div className="mb-2 h-4 w-full rounded bg-[color:var(--surface-muted)]"></div>
                  <div className="h-4 w-5/6 rounded bg-[color:var(--surface-muted)]"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Skeleton comparison */}
        <div className="mt-12 border-t border-[color:var(--divider-color)] pt-6 sm:mt-16 sm:pt-8">
          <div className="flex flex-col md:flex-row justify-center items-center gap-8">
            <div className="flex-1">
              <div className="mx-auto mb-4 h-6 w-1/2 rounded bg-[color:var(--surface-muted)] md:ml-auto md:mr-0"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="mx-auto h-4 w-3/4 rounded bg-[color:var(--surface-muted)] md:ml-auto md:mr-0"></div>
                ))}
              </div>
            </div>

            <div className="hidden h-40 border-l border-[color:var(--divider-color)] md:block" aria-hidden="true"></div>

            <div className="flex-1">
              <div className="mx-auto mb-4 h-6 w-1/2 rounded bg-[color:var(--surface-muted)] md:ml-0 md:mr-auto"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="mx-auto h-4 w-3/4 rounded bg-[color:var(--surface-muted)] md:ml-0 md:mr-auto"></div>
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
    // eslint-disable-next-line no-restricted-syntax
    <section className="w-full py-10 sm:py-16 md:py-24 px-4 sm:px-6 relative">
      {/* Add styles to head for animations */}
      <style jsx global>{`${fadeInUp} ${slideInFromSide} ${pulse}`}</style>

      {/* Background element */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute right-[6%] top-1/4 -translate-y-1/2 h-52 w-52 rounded-full bg-[color:var(--tone-info-surface)] opacity-30 blur-2xl"
          style={{
            animation: `pulse 15s ease-in-out infinite alternate`,
          }}
        ></div>
        <div
          className="absolute left-[6%] bottom-1/4 translate-y-1/2 h-52 w-52 rounded-full bg-[color:var(--tone-accent-surface)] opacity-30 blur-2xl"
          style={{
            animation: `pulse 18s ease-in-out infinite alternate-reverse`,
          }}
        ></div>
      </div>
      
      <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
        <h2 
          id="benefits-heading"
          className="text-2xl font-bold text-foreground drop-shadow-sm opacity-0 sm:text-3xl md:text-5xl"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast}ms`
          }}
        >
          {SCOPE_CLAIMS.pmleOnly.description}
        </h2>
        
        <p
          className="mx-auto max-w-3xl text-balance text-base text-muted-foreground opacity-0 sm:text-lg md:text-xl"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 2}ms`
          }}
        >
          Start free with a diagnostic. Upgrade for explanations and unlimited targeted practice.
        </p>
        
        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 text-left"
          role="list"
        >
          {/* Feature 1 - Readiness Baseline */}
          <BenefitCard
            icon={<Sparkles className="w-6 h-6" />}
            title={VALUE_PILLARS.readiness.title}
            description={VALUE_PILLARS.readiness.description}
            tone="success"
            delay={duration.fast * 3}
          />
          
          {/* Feature 2 - Study Right Topics */}
          <BenefitCard
            icon={<BarChart3 className="w-6 h-6" />}
            title={VALUE_PILLARS.blueprint.title}
            description={VALUE_PILLARS.blueprint.description}
            tone="info"
            delay={duration.fast * 4}
          />
          
          {/* Feature 3 - Explanations */}
          <BenefitCard
            icon={<Cloud className="w-6 h-6" />}
            title={VALUE_PILLARS.explanations.title}
            description={VALUE_PILLARS.explanations.description}
            tone="accent"
            delay={duration.fast * 5}
          />
        </div>
        
        {/* Feature availability and CTA */}
        <div
          className="mt-12 border-t border-[color:var(--divider-color)] pt-6 opacity-0 sm:mt-16 sm:pt-8"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 7}ms`
          }}
        >
          <div className="text-center">
            <h3 className="mb-4 text-2xl font-bold text-foreground">Ready to Start Preparing?</h3>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
              Join hundreds of cloud professionals already using Testero to accelerate their certification journey.
            </p>
            <div className="mx-auto flex max-w-lg flex-col justify-center gap-4 sm:flex-row">
              <Button asChild tone="accent" size="lg" className="text-lg">
                <Link href="/signup">Start Free Practice</Link>
              </Button>
              <Button asChild variant="outline" tone="accent" size="lg" className="text-lg">
                <Link href="/diagnostic">Take Diagnostic Test</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free diagnostic • No credit card • Instant access</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// For backward compatibility
export default BenefitsSection;
