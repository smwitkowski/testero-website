"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { duration, easing } from '@/lib/design-system';

type ProofTone = 'accent' | 'success' | 'info' | 'primary';

const toneStyles: Record<ProofTone, { icon: string; highlight: string }> = {
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

interface SocialProofCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: ProofTone;
  delay?: number;
}

const SocialProofCard: React.FC<SocialProofCardProps> = ({
  icon,
  title,
  subtitle,
  tone,
  delay = 0
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const toneClass = toneStyles[tone];
  const sizeClass = title.length > 10 ? 'text-lg' : 'text-xl';

  return (
    <article
      className={cn(
        'rounded-lg border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-4 md:p-6 shadow-md',
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
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'mb-4 flex h-12 w-12 items-center justify-center rounded-full transition-transform',
            isHovered ? 'scale-110' : 'scale-100',
            toneClass.icon
          )}
          aria-hidden="true"
        >
          <div className="transition-all">{icon}</div>
        </div>

        <h3
          className={cn(
            'text-center font-semibold text-foreground transition-all duration-300',
            sizeClass,
            isHovered && cn('text-3xl font-bold', toneClass.highlight)
          )}
        >
          {title}
        </h3>

        <p className="text-center text-muted-foreground">{subtitle}</p>
      </div>
    </article>
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
    // eslint-disable-next-line no-restricted-syntax
    <section className="relative w-full bg-[color:var(--surface-subtle)] px-4 py-8 sm:px-6 sm:py-12 md:py-20">
      {/* Add styles to head for animations */}
      <style jsx global>{fadeInUp}</style>


      <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
        <h2
          id="social-proof-heading"
          className={cn(
            "text-xl font-semibold text-muted-foreground sm:text-2xl md:text-3xl",
            "opacity-0"
          )}
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast}ms`
          }}
        >
          Trusted by Hundreds of Cloud Professionals Worldwide
        </h2>
        
        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4" role="list">
          {/* Card 1: User Count */}
          <SocialProofCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
            title="500+ Active Users"
            subtitle="Already Practicing with Testero"
            tone="info"
            delay={duration.fast * 2}
          />
          
          {/* Card 2: Founder */}
          <SocialProofCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
            }
            title="Built by Cloud Certification Experts"
            subtitle="Ex-Google Cloud PSO Leadership Team"
            tone="success"
            delay={duration.fast * 3}
          />
          
          {/* Card 3: Featured */}
          <SocialProofCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            }
            title="Award-Winning Platform"
            subtitle="Product Hunt Top Launch for Certification Tools"
            tone="accent"
            delay={duration.fast * 4}
          />
          
          {/* Card 4: Features */}
          <SocialProofCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            }
            title="Available Now"
            subtitle="Practice Questions & Diagnostics Ready"
            tone="accent"
            delay={duration.fast * 5}
          />
        </div>
        
        {/* Additional Testimonial Row (Optional) */}
        <figure
          className="mt-8 max-w-2xl opacity-0 sm:mt-12"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 6}ms`
          }}
        >
          <div className="rounded-xl border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-4 md:p-6 shadow-md">
          <h3 className="sr-only">Customer Testimonial</h3>
          <blockquote className="text-base italic text-muted-foreground sm:text-lg">
            &quot;The diagnostic test immediately showed me my weak areas in Google Cloud. The practice questions with detailed explanations helped me understand concepts I was struggling with. Great platform!&quot;
          </blockquote>
          <figcaption className="mt-4 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--surface-muted)] font-medium text-foreground" aria-hidden="true">AS</div>
            <div className="ml-3 text-left">
              <p className="font-medium">Alex Smith</p>
              <p className="text-sm text-muted-foreground">Cloud Solutions Architect</p>
            </div>
          </figcaption>
          </div>
        </figure>

        {/* Logos Section (Placeholder - Replace with actual partner logos when available) */}
        <div
          className="mt-16 opacity-0"
          style={{
            animation: `fadeInUp ${duration.slow}ms ${easing.spring} forwards`,
            animationDelay: `${duration.fast * 7}ms`
          }}
        >
          <h3 className="mb-6 text-sm uppercase tracking-wide text-muted-foreground" id="certification-providers">Supporting Major Cloud Certification Programs</h3>
          <ul className="flex flex-wrap justify-center gap-4 opacity-80 sm:gap-8" aria-labelledby="certification-providers">
            <li className="flex h-12 w-32 items-center justify-center rounded bg-[color:var(--tone-info-surface)] text-[color:var(--tone-info)] font-medium text-sm">Google Cloud</li>
            <li className="flex h-12 w-32 items-center justify-center rounded bg-[color:var(--tone-accent-surface)] text-[color:var(--tone-accent)] font-medium text-sm">AWS</li>
            <li className="flex h-12 w-32 items-center justify-center rounded bg-[color:var(--tone-info-surface)] text-[color:var(--tone-info)] font-medium text-sm">Microsoft Azure</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
