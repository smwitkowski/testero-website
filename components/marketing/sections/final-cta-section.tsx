"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, BarChart3, CheckCircle2, Users, Cloud } from "lucide-react";

export function FinalCtaSection() {
  return (
    // eslint-disable-next-line no-restricted-syntax
    <section className="relative w-full overflow-hidden px-4 py-10 text-center sm:px-6 sm:py-16 md:py-24 ds-gradient-accent-surface">
      {/* Enhanced Background Elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 right-0 opacity-20 transform translate-x-1/4 -translate-y-1/4">
          <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="200" cy="200" r="180" stroke="var(--tone-accent-border)" strokeWidth="2" strokeDasharray="8 8" />
            <circle cx="200" cy="200" r="120" stroke="var(--tone-accent-border)" strokeWidth="2" strokeDasharray="6 6" />
            <circle cx="200" cy="200" r="60" stroke="var(--tone-accent-border)" strokeWidth="2" strokeDasharray="4 4" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 opacity-20 transform -translate-x-1/4 translate-y-1/4">
          <svg width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="40" y="40" width="240" height="240" stroke="var(--tone-accent-border)" strokeWidth="2" strokeDasharray="6 6" />
            <rect x="80" y="80" width="160" height="160" stroke="var(--tone-accent-border)" strokeWidth="2" strokeDasharray="4 4" />
          </svg>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        {/* Attention grabber with pulse animation */}
        <motion.div
          className="mb-8 inline-block"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="ds-gradient-success-pill inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow-md">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Free Diagnostic Available Now
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </span>
        </motion.div>
        
        {/* Headline with more emphasis */}
        <h2
          id="final-cta-heading"
          className="text-2xl font-bold leading-tight text-foreground drop-shadow-sm sm:text-3xl md:text-5xl"
        >
          Know Your PMLE Readiness Before You Book
        </h2>
        
        {/* Value proposition with enhanced highlight */}
        <p className="mx-auto max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
          Get your exact readiness score in minutes. Practice with blueprint-aligned questions and unlock explanations when you&apos;re ready to dive deeper.
        </p>
        
        {/* Feature bullets with icons */}
        <ul className="mx-auto flex max-w-3xl flex-col justify-center gap-4 text-left md:flex-row" role="list">
          <li className="flex flex-1 items-start gap-3 rounded-lg border border-[color:var(--tone-accent-border)] bg-[color:color-mix(in oklch, var(--surface-elevated) 78%, transparent)] p-4 backdrop-blur-sm">
            <div className="rounded-full bg-[color:var(--tone-accent-surface)] p-2 text-[color:var(--tone-accent)]" aria-hidden="true">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Smart Diagnostic Tests</h3>
              <p className="text-sm text-muted-foreground">Identify your knowledge gaps instantly with personalized assessments.</p>
            </div>
          </li>

          <li className="flex flex-1 items-start gap-3 rounded-lg border border-[color:var(--tone-accent-border)] bg-[color:color-mix(in oklch, var(--surface-elevated) 78%, transparent)] p-4 backdrop-blur-sm">
            <div className="rounded-full bg-[color:var(--tone-accent-surface)] p-2 text-[color:var(--tone-accent)]" aria-hidden="true">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Practice Questions</h3>
              <p className="text-sm text-muted-foreground">Learn with real exam-style questions and detailed explanations.</p>
            </div>
          </li>

          <li className="flex flex-1 items-start gap-3 rounded-lg border border-[color:var(--tone-accent-border)] bg-[color:color-mix(in oklch, var(--surface-elevated) 78%, transparent)] p-4 backdrop-blur-sm">
            <div className="rounded-full bg-[color:var(--tone-accent-surface)] p-2 text-[color:var(--tone-accent)]" aria-hidden="true">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Progress Tracking</h3>
              <p className="text-sm text-muted-foreground">Monitor your readiness with detailed analytics and insights.</p>
            </div>
          </li>
        </ul>
          
        {/* Enhanced CTA Container */}
        <div className="mx-auto max-w-lg pt-6">
          <motion.div
            className="rounded-xl border border-[color:var(--tone-accent-border)] bg-[color:var(--surface-elevated)] p-4 md:p-6 shadow-xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="mb-6 text-xl font-semibold text-foreground" id="final-cta-form-heading">Start Your Certification Journey Today</h3>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" tone="accent" className="text-lg">
                <Link href="/signup">
                  Start Free Practice
                </Link>
              </Button>
              <Button asChild variant="outline" tone="accent" size="lg" className="text-lg">
                <Link href="/diagnostic">
                  Take Diagnostic Test
                </Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <ul className="mt-6 flex flex-col gap-2" aria-label="Trust guarantees">
              <li className="flex items-center justify-center text-sm text-muted-foreground">
                <CheckCircle2 className="mr-2 h-4 w-4 text-[color:var(--tone-success)]" aria-hidden="true" />
                Free diagnostic • No credit card required • Instant access
              </li>
            </ul>
          </motion.div>
        </div>
        
        {/* Social proof */}
        <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground md:flex-row md:gap-6">
          <div className="flex items-center">
            <Users className="mr-1 h-4 w-4 text-[color:var(--tone-accent)]" aria-hidden="true" />
            Join hundreds of cloud professionals already practicing
          </div>
          <div className="hidden h-1 w-1 rounded-full bg-[color:var(--divider-color)] md:block" aria-hidden="true"></div>
          <div className="flex items-center">
            <Cloud className="mr-1 h-4 w-4 text-[color:var(--tone-accent)]" aria-hidden="true" />
            PMLE-focused • Blueprint-aligned • Diagnostic-first
          </div>
        </div>
      </div>
    </section>
  );
}
