"use client";

import React from "react";
import Image from "next/image";

import { Marquee } from "@/components/marketing/effects/marquee";
import { Section } from "@/components/patterns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { partners, type Partner } from "@/data/partners";
import { cn } from "@/lib/utils";

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
    <Card
      aria-label={`Visit ${partner.name} website`}
      className={cn(
        "group relative flex h-20 w-40 cursor-pointer items-center justify-center overflow-hidden",
        "bg-surface-muted/70 text-muted-foreground transition-transform duration-200 hover:-translate-y-0.5 hover:bg-surface-elevated",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "dark:bg-surface-muted/50",
        className
      )}
      compact
      allowInternalSpacingOverride
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Image
        src={partner.logo}
        alt={partner.logoAlt}
        width={120}
        height={48}
        loading="lazy"
        className="h-12 w-auto object-contain opacity-80 transition duration-300 ease-out grayscale group-hover:opacity-100 group-hover:grayscale-0"
      />
    </Card>
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
    <Section
      role="region"
      aria-label="Our trusted partners"
      size={isCompact ? "md" : "xl"}
      surface="default"
      className={className}
    >
      <div className="flex flex-col gap-10">
        <div className="flex flex-col items-center text-center gap-4">
          <Badge tone="accent" variant="soft" size={isCompact ? "sm" : "md"} className="w-fit">
            Trusted by teams
          </Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="relative">
          {showGradientMask ? (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-24">
                <div className="h-full w-full bg-gradient-to-r from-background via-transparent to-background" />
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-24">
                <div className="h-full w-full rotate-180 bg-gradient-to-r from-background via-transparent to-background" />
              </div>
            </>
          ) : null}

          <div
            className="relative h-24 w-full overflow-hidden"
            aria-live="polite"
            aria-label="Partner logos carousel"
          >
            {prefersReducedMotion ? (
              <div className="grid h-full grid-cols-2 items-center gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {partnerList.slice(0, 8).map((partner) => (
                  <LogoCard key={partner.id} partner={partner} className="h-full w-full" />
                ))}
              </div>
            ) : (
              <Marquee speed={marqueeSpeed} pauseOnHover={pauseOnHover} reverse={direction === "right"}>
                {partnerList.map((partner) => (
                  <LogoCard key={partner.id} partner={partner} className="mx-3 flex-shrink-0" />
                ))}
              </Marquee>
            )}
          </div>
        </div>

        {!isCompact ? (
          <p className="text-center text-sm text-muted-foreground">
            Join 100+ companies that trust our platform
          </p>
        ) : null}
      </div>
    </Section>
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