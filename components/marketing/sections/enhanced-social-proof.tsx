"use client"

import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"

import { Marquee } from "@/components/marketing/effects/marquee"
import { Section } from "@/components/patterns"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Clock, BadgeCheck, BarChart3, Sparkles, Gift } from "lucide-react"

type BadgeTone = NonNullable<BadgeProps["tone"]>

interface SocialProofBadge {
  icon: React.ReactNode
  title: string
  subtitle: string
  tone: BadgeTone
}

const socialProofBadges: SocialProofBadge[] = [
  {
    icon: <Clock className="h-4 w-4" />,
    title: "14-Day Updates",
    subtitle: "Blueprint Changes",
    tone: "accent",
  },
  {
    icon: <BadgeCheck className="h-4 w-4" />,
    title: "Ex-Google PSO",
    subtitle: "Expert-Built Content",
    tone: "success",
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: "Readiness Score",
    subtitle: "Know Before You Book",
    tone: "accent",
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    title: "15-Min Diagnostic",
    subtitle: "Know Your Readiness",
    tone: "warning",
  },
  {
    icon: <Clock className="h-4 w-4" />,
    title: "Targeted Practice",
    subtitle: "Focus on Weak Domains",
    tone: "accent",
  },
  {
    icon: <Gift className="h-4 w-4" />,
    title: "Free Diagnostic",
    subtitle: "No Credit Card",
    tone: "success",
  },
]

const SocialProofCard = ({ badge }: { badge: SocialProofBadge }) => {
  return (
    <motion.div
      className="mx-2 w-56 flex-shrink-0"
      whileHover={{
        y: -4,
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      initial={{ opacity: 0.8 }}
      whileInView={{ opacity: 1 }}
    >
      <Card size="sm" className="border border-border/60 bg-card text-card-foreground transition-all duration-200 hover:shadow-lg">
        <div className="flex flex-col gap-3">
          <Badge
            size="sm"
            variant="soft"
            tone={badge.tone}
            icon={badge.icon}
            className="w-fit"
          >
            {badge.title}
          </Badge>
          <p className="text-sm text-muted-foreground">{badge.subtitle}</p>
        </div>
      </Card>
    </motion.div>
  );
};

export function EnhancedSocialProof() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <Section ref={ref} size="lg" surface="default" className="overflow-hidden">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="mb-12 text-balance text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        Trusted by Hundreds of Cloud Professionals Worldwide
      </motion.h2>

      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <Marquee pauseOnHover speed="normal" repeat={2}>
          {socialProofBadges.map((badge, index) => (
            <SocialProofCard key={index} badge={badge} />
          ))}
        </Marquee>
      </motion.div>
    </Section>
  );
}
