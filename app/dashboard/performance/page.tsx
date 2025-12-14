"use client";

import React, { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Target, TrendingUp, ArrowRight } from "lucide-react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/analytics";

const PerformanceComingSoonPage = () => {
  const posthog = usePostHog();
  const pathname = usePathname();
  const hasTrackedDiscovery = useRef(false);

  // Track feature discovery on first render
  useEffect(() => {
    if (!hasTrackedDiscovery.current && posthog) {
      trackEvent(posthog, ANALYTICS_EVENTS.FEATURE_DISCOVERED, {
        feature: "performance",
        status: "coming_soon",
        route: pathname,
      });
      hasTrackedDiscovery.current = true;
    }
  }, [posthog, pathname]);

  const handleStartPractice = () => {
    if (posthog) {
      trackEvent(posthog, ANALYTICS_EVENTS.FEATURE_USED, {
        feature: "performance",
        action: "start_practice_clicked",
        route: pathname,
      });
    }
  };

  const handleTakeDiagnostic = () => {
    if (posthog) {
      trackEvent(posthog, ANALYTICS_EVENTS.FEATURE_USED, {
        feature: "performance",
        action: "take_diagnostic_clicked",
        route: pathname,
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full p-4 bg-accent/10">
            <BarChart3 className="w-12 h-12 text-accent" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Performance (Coming Soon)</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          This will show your readiness trends, weakest domains, and what to do next.
        </p>
      </div>

      {/* What's Coming Section */}
      <Card>
        <CardHeader>
          <CardTitle>What You&apos;ll See</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg p-2 bg-accent/10">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Readiness Trends Over Time</h3>
              <p className="text-sm text-muted-foreground">
                Track how your exam readiness improves as you practice and identify patterns in your performance.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-lg p-2 bg-accent/10">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Blueprint Coverage & Domain Weaknesses</h3>
              <p className="text-sm text-muted-foreground">
                See which PMLE domains need more practice and how your coverage compares to the exam blueprint.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-lg p-2 bg-accent/10">
              <ArrowRight className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Personalized Next Steps</h3>
              <p className="text-sm text-muted-foreground">
                Get AI-powered recommendations on what to practice next based on your performance data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTAs Section */}
      <div className="space-y-4">
        <p className="text-center text-muted-foreground">
          Start building your performance data now:
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/practice/question" onClick={handleStartPractice}>
            <Button tone="accent" size="lg" className="w-full sm:w-auto">
              Start a Practice Session
            </Button>
          </Link>
          <Link href="/diagnostic" onClick={handleTakeDiagnostic}>
            <Button variant="outline" tone="neutral" size="lg" className="w-full sm:w-auto">
              Take a Diagnostic
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PerformanceComingSoonPage;
