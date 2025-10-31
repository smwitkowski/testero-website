"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
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
            <span className="mr-2" aria-hidden="true">✅</span>
            Available Now - Free Forever
            <span className="ml-2" aria-hidden="true">✅</span>
          </span>
        </motion.div>
        
        {/* Headline with more emphasis */}
        <h2
          id="final-cta-heading"
          className="text-2xl font-bold leading-tight text-foreground drop-shadow-sm sm:text-3xl md:text-5xl"
        >
          Google Cloud Updated Their Blueprint <span className="text-[color:var(--tone-accent)]">3 Days Ago</span>.
          <br />
          We&apos;ve Already Updated.
        </h2>
        
        {/* Value proposition with enhanced highlight */}
        <p className="mx-auto max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
          Don&apos;t waste months studying outdated materials. Get your exact readiness score in 15 minutes and start practicing with content that&apos;s always current.
        </p>
        
        {/* Feature bullets with icons */}
        <ul className="mx-auto flex max-w-3xl flex-col justify-center gap-4 text-left md:flex-row" role="list">
          <li className="flex flex-1 items-start gap-3 rounded-lg border border-[color:var(--tone-accent-border)] bg-[color:color-mix(in oklch, var(--surface-elevated) 78%, transparent)] p-4 backdrop-blur-sm">
            <div className="rounded-full bg-[color:var(--tone-accent-surface)] p-2 text-[color:var(--tone-accent)]" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Smart Diagnostic Tests</h3>
              <p className="text-sm text-muted-foreground">Identify your knowledge gaps instantly with personalized assessments.</p>
            </div>
          </li>

          <li className="flex flex-1 items-start gap-3 rounded-lg border border-[color:var(--tone-accent-border)] bg-[color:color-mix(in oklch, var(--surface-elevated) 78%, transparent)] p-4 backdrop-blur-sm">
            <div className="rounded-full bg-[color:var(--tone-accent-surface)] p-2 text-[color:var(--tone-accent)]" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Practice Questions</h3>
              <p className="text-sm text-muted-foreground">Learn with real exam-style questions and detailed explanations.</p>
            </div>
          </li>

          <li className="flex flex-1 items-start gap-3 rounded-lg border border-[color:var(--tone-accent-border)] bg-[color:color-mix(in oklch, var(--surface-elevated) 78%, transparent)] p-4 backdrop-blur-sm">
            <div className="rounded-full bg-[color:var(--tone-accent-surface)] p-2 text-[color:var(--tone-accent)]" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 h-4 w-4 text-[color:var(--tone-success)]" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Free forever tier • No credit card required • Instant access
              </li>
            </ul>
          </motion.div>
        </div>
        
        {/* Social proof */}
        <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground md:flex-row md:gap-6">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-1 h-4 w-4 text-[color:var(--tone-accent)]" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            Join hundreds of cloud professionals already practicing
          </div>
          <div className="hidden h-1 w-1 rounded-full bg-[color:var(--divider-color)] md:block" aria-hidden="true"></div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-1 h-4 w-4 text-[color:var(--tone-accent)]" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
            </svg>
            Supporting Google Cloud, AWS & Azure certifications
          </div>
        </div>
      </div>
    </section>
  );
}
