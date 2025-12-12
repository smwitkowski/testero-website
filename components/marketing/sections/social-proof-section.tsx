"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { duration, easing } from '@/lib/design-system';
import { Users, BadgeCheck, Star, Sparkles } from 'lucide-react';

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
            icon={<Users className="w-6 h-6" />}
            title="500+ Active Users"
            subtitle="Already Practicing with Testero"
            tone="info"
            delay={duration.fast * 2}
          />
          
          {/* Card 2: Founder */}
          <SocialProofCard
            icon={<BadgeCheck className="w-6 h-6" />}
            title="Built by Cloud Certification Experts"
            subtitle="Ex-Google Cloud PSO Leadership Team"
            tone="success"
            delay={duration.fast * 3}
          />
          
          {/* Card 3: Featured */}
          <SocialProofCard
            icon={<Star className="w-6 h-6" />}
            title="Award-Winning Platform"
            subtitle="Product Hunt Top Launch for Certification Tools"
            tone="accent"
            delay={duration.fast * 4}
          />
          
          {/* Card 4: Features */}
          <SocialProofCard
            icon={<Sparkles className="w-6 h-6" />}
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
