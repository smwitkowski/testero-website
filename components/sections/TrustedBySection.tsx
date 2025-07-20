"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Marquee } from "@/components/marketing/effects/marquee";
import { partners, type Partner } from "@/data/partners";

// Component-specific design tokens following the design system
const designTokens = {
  colors: {
    // Using design system color tokens
    background: "bg-white dark:bg-slate-950",
    surface: "bg-white dark:bg-slate-900",
    text: {
      primary: "text-slate-800 dark:text-white",
      secondary: "text-slate-600 dark:text-slate-400",
      muted: "text-slate-400 dark:text-slate-600",
    },
    logo: {
      container: "bg-slate-50 dark:bg-slate-800/50",
      border: "border-slate-200 dark:border-slate-700",
    },
  },
  typography: {
    // Using design system typography tokens
    sectionTitle: "text-2xl sm:text-3xl md:text-4xl font-semibold",
    subtitle: "text-base md:text-lg",
    logoTitle: "text-sm font-semibold",
  },
  spacing: {
    section: "py-16 md:py-20",
    container: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
    logo: "h-12 md:h-16",
    logoContainer: "h-20 md:h-24",
  },
  effects: {
    logoHover: "hover:scale-105 transition-all duration-300",
    logoFilter: "grayscale hover:grayscale-0 opacity-70 hover:opacity-100",
    gradientMask: "bg-gradient-to-r from-white via-transparent to-white dark:from-slate-950 dark:via-transparent dark:to-slate-950",
  },
};

interface LogoCardProps {
  partner: Partner;
  className?: string;
}

function LogoCard({ partner, className }: LogoCardProps) {
  const handleClick = () => {
    if (partner.website) {
      window.open(partner.website, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={cn(
        // Base container styles
        "flex items-center justify-center p-4 rounded-lg border cursor-pointer",
        // Design system colors
        designTokens.colors.logo.container,
        designTokens.colors.logo.border,
        // Effects
        designTokens.effects.logoHover,
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Visit ${partner.name} website`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <Image
          src={partner.logo}
          alt={partner.logoAlt}
          width={120}
          height={48}
          className={cn(
            "object-contain transition-all duration-300",
            designTokens.spacing.logo,
            designTokens.effects.logoFilter
          )}
          priority={false}
          loading="lazy"
        />
      </div>
    </div>
  );
}

interface TrustedBySectionProps {
  title?: string;
  subtitle?: string;
  partners?: Partner[];
  speed?: "slow" | "normal" | "fast";
  pauseOnHover?: boolean;
  direction?: "left" | "right";
  className?: string;
  variant?: "default" | "compact";
  showGradientMask?: boolean;
}

export function TrustedBySection({
  title = "Trusted by industry leaders",
  subtitle,
  partners: partnerList = partners,
  speed = "slow",
  pauseOnHover = true,
  direction = "left",
  className,
  variant = "default",
  showGradientMask = true,
}: TrustedBySectionProps) {
  // Accessibility: Respect reduced motion preference
  const prefersReducedMotion = 
    typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isCompact = variant === "compact";
  const marqueeSpeed = prefersReducedMotion ? "slow" : speed;

  return (
    <section
      className={cn(
        designTokens.colors.background,
        isCompact ? "py-8 md:py-12" : designTokens.spacing.section,
        className
      )}
      role="region"
      aria-label="Our trusted partners"
    >
      <div className={designTokens.spacing.container}>
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <h2
            className={cn(
              designTokens.typography.sectionTitle,
              designTokens.colors.text.primary
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={cn(
                designTokens.typography.subtitle,
                designTokens.colors.text.secondary,
                "mt-4"
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Logo Carousel */}
        <div className="relative">
          {/* Gradient masks for fade effect */}
          {showGradientMask && (
            <>
              <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none">
                <div className={cn(
                  "w-full h-full",
                  designTokens.effects.gradientMask
                )} />
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none">
                <div className={cn(
                  "w-full h-full rotate-180",
                  designTokens.effects.gradientMask
                )} />
              </div>
            </>
          )}

          {/* Marquee Container */}
          <div 
            className={cn(
              "overflow-hidden w-full",
              designTokens.spacing.logoContainer
            )}
            aria-live="polite"
            aria-label="Partner logos carousel"
          >
            {prefersReducedMotion ? (
              // Static grid for reduced motion
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 items-center">
                {partnerList.slice(0, 8).map((partner) => (
                  <LogoCard
                    key={partner.id}
                    partner={partner}
                    className="w-full"
                  />
                ))}
              </div>
            ) : (
              // Animated marquee
              <Marquee
                speed={marqueeSpeed}
                pauseOnHover={pauseOnHover}
                reverse={direction === "right"}
              >
                {partnerList.map((partner) => (
                  <LogoCard
                    key={partner.id}
                    partner={partner}
                    className="w-36 md:w-44 flex-shrink-0 mx-2"
                  />
                ))}
              </Marquee>
            )}
          </div>
        </div>

        {/* Optional CTA */}
        {!isCompact && (
          <div className="text-center mt-8 md:mt-12">
            <p className={cn(
              "text-sm",
              designTokens.colors.text.muted
            )}>
              Join 100+ companies that trust our platform
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// Export individual logo card for reuse
export { LogoCard };

// Pre-configured variants
export function CompactTrustedBy(props: Omit<TrustedBySectionProps, 'variant'>) {
  return <TrustedBySection {...props} variant="compact" />;
}

export function FastTrustedBy(props: Omit<TrustedBySectionProps, 'speed'>) {
  return <TrustedBySection {...props} speed="fast" />;
}