"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ReadinessSnapshotCard } from "@/components/dashboard/ReadinessSnapshotCard";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ExamBlueprintTable } from "@/components/dashboard/ExamBlueprintTable";
import { NextBestStepCard } from "@/components/dashboard/NextBestStepCard";
import { RecentActivityList, type Activity } from "@/components/dashboard/RecentActivityList";
import { Button } from "@/components/ui/button";
import { colorSemantic } from "@/lib/design-system";
import { usePostHog } from "posthog-js/react";
import { X } from "lucide-react";
import { useStartBasicCheckout } from "@/hooks/useStartBasicCheckout";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import type { DomainStat } from "@/components/dashboard/ExamBlueprintTable";

// Import types from the API route
import type { DashboardData, SuccessResponse, ErrorResponse } from "@/app/api/dashboard/route";
import type { ExamReadinessSummary, DashboardSummarySuccessResponse, ErrorResponse as DashboardSummaryErrorResponse } from "@/app/api/dashboard/summary/route";

// Import beta onboarding constants
import { FEATURE_FLAGS, getBetaVariantContent } from "@/lib/constants/beta-onboarding";
import {
  getPmleAccessLevelForUser,
  type AccessLevel,
} from "@/lib/access/pmleEntitlements";
import type { BillingStatusResponse } from "@/app/api/billing/status/route";

const DashboardPage = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [examReadiness, setExamReadiness] = useState<ExamReadinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBetaBanner, setShowBetaBanner] = useState(false);
  const [betaVariant, setBetaVariant] = useState<'A' | 'B'>('A');
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("ANONYMOUS");
  const posthog = usePostHog();
  const { startBasicCheckout } = useStartBasicCheckout();

  // Fetch billing status to compute access level
  useEffect(() => {
    if (!user) {
      setAccessLevel("ANONYMOUS");
      return;
    }

    const fetchBillingStatus = async () => {
      try {
        const response = await fetch("/api/billing/status");
        if (response.ok) {
          const data = (await response.json()) as BillingStatusResponse;
          const level = getPmleAccessLevelForUser(user, data);
          setAccessLevel(level);
        }
      } catch (err) {
        console.error("Error fetching billing status:", err);
        // Default to FREE if fetch fails (user is logged in)
        setAccessLevel(getPmleAccessLevelForUser(user, null));
      }
    };

    fetchBillingStatus();
  }, [user]);

  // Track dashboard page view (middleware ensures auth)
  useEffect(() => {
    if (user) {
      posthog?.capture("dashboard_viewed", {
        user_id: user.id,
        access_level: accessLevel,
      });
    }
  }, [user, posthog, accessLevel]);

  // Check if we should show the beta banner
  useEffect(() => {
    if (FEATURE_FLAGS.BETA_ONBOARDING_FLOW) {
      const urlParams = new URLSearchParams(window.location.search);
      const fromBetaWelcome = urlParams.get('from') === 'beta_welcome';
      const variant = urlParams.get('beta_variant') as 'A' | 'B' | null;
      let dismissed = null;
      try {
        dismissed = localStorage.getItem('beta_diagnostic_banner_dismissed');
      } catch {
        // no-op
      }
      
      if (variant) {
        setBetaVariant(variant === 'B' ? 'B' : 'A');
        try {
          localStorage.setItem('beta_variant', variant === 'B' ? 'B' : 'A');
        } catch {
          // no-op
        }
      }
      
      if (fromBetaWelcome && !dismissed) {
        setShowBetaBanner(true);
      }
    }
  }, []);

  useEffect(() => {
    // Middleware ensures user is authenticated
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/dashboard");
        const data: SuccessResponse | ErrorResponse = await response.json();

        if (!response.ok) {
          throw new Error((data as ErrorResponse).error || "Failed to fetch dashboard data");
        }

        setDashboardData((data as SuccessResponse).data);

        // Track successful dashboard load with metrics
        posthog?.capture("dashboard_loaded", {
          user_id: user.id,
          readiness_score: (data as SuccessResponse).data.readinessScore,
          total_diagnostic_sessions: (data as SuccessResponse).data.diagnostic.totalSessions,
          total_practice_questions: (data as SuccessResponse).data.practice.totalQuestionsAnswered,
          correct_answers: (data as SuccessResponse).data.practice.correctAnswers,
          accuracy_percentage: (data as SuccessResponse).data.practice.accuracyPercentage,
          has_diagnostic_data: (data as SuccessResponse).data.diagnostic.totalSessions > 0,
          has_practice_data: (data as SuccessResponse).data.practice.totalQuestionsAnswered > 0,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);

        // Track dashboard load error
        posthog?.capture("dashboard_error", {
          user_id: user?.id,
          error: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, posthog]);

  // Fetch exam readiness summary separately
  useEffect(() => {
    if (!user) return;

    const fetchExamReadiness = async () => {
      try {
        const response = await fetch("/api/dashboard/summary?examKey=pmle");
        const data: DashboardSummarySuccessResponse | DashboardSummaryErrorResponse = await response.json();

        if (response.ok && 'status' in data && data.status === 'ok') {
          setExamReadiness(data.data);
        } else {
          // Log error but don't break the dashboard - fall back to empty state
          const errorMessage = 'error' in data ? data.error : "Unknown error";
          console.error('Failed to fetch exam readiness summary:', errorMessage);
          posthog?.capture("dashboard_readiness_summary_error", {
            user_id: user.id,
            error: errorMessage,
          });
        }
      } catch (err) {
        // Log error but don't break the dashboard
        console.error('Error fetching exam readiness summary:', err);
        posthog?.capture("dashboard_readiness_summary_error", {
          user_id: user.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    };

    fetchExamReadiness();
  }, [user, posthog]);

  const handleDismissBanner = () => {
    setShowBetaBanner(false);
    try {
      localStorage.setItem('beta_diagnostic_banner_dismissed', 'true');
    } catch {
      // no-op
    }
  };

  const handleStartDiagnostic = async () => {
    try {
      const response = await fetch('/api/diagnostic/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examKey: 'pmle',
          source: 'dashboard_readiness_card',
        }),
      });

      if (response.ok) {
        const { sessionId } = await response.json();
        window.location.href = `/diagnostic/${sessionId}`;
      }
    } catch (error) {
      console.error('Error starting diagnostic:', error);
    }
  };

  const handleStartPractice = () => {
    window.location.href = '/practice/question';
  };

  const handleReviewWeakest = () => {
    // Navigate to practice with weakest domain filter
    const weakestDomain = mockDomainStats.find(
      (stat) => stat.accuracy === Math.min(...mockDomainStats.map((s) => s.accuracy))
    );
    if (weakestDomain) {
      const domainConfig = PMLE_BLUEPRINT.find((d) => d.domainCode === weakestDomain.domainCode);
      if (domainConfig) {
        window.location.href = `/practice/question?domain=${encodeURIComponent(domainConfig.displayName)}`;
      }
    }
  };

  // Mock domain stats (placeholder until API provides this data)
  const mockDomainStats: DomainStat[] = useMemo(() => {
    return PMLE_BLUEPRINT.map((domain) => {
      // Mock data - in production this would come from API
      const baseQuestions = Math.floor(Math.random() * 50) + 10;
      const answered = Math.floor(baseQuestions * (0.5 + Math.random() * 0.5));
      const accuracy = Math.floor(Math.random() * 40) + 60; // 60-100%
      
      return {
        domainCode: domain.domainCode,
        questionsAnswered: answered,
        totalQuestions: baseQuestions,
        accuracy,
      };
    });
  }, []);

  // Calculate weakest domain for recommendations
  const weakestDomain = useMemo(() => {
    if (mockDomainStats.length === 0) return null;
    const weakest = mockDomainStats.reduce((min, stat) =>
      stat.accuracy < min.accuracy ? stat : min
    );
    const domainConfig = PMLE_BLUEPRINT.find((d) => d.domainCode === weakest.domainCode);
    return domainConfig ? { ...weakest, displayName: domainConfig.displayName } : null;
  }, [mockDomainStats]);

  // Mock recent activities (placeholder until API provides this data)
  const mockActivities: Activity[] = useMemo(() => {
    return [
      {
        type: "exam_completed",
        title: "Completed a 50-question exam",
        score: 88,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        type: "domain_mastered",
        title: "Mastered 'Stakeholder Engagement'",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        type: "quiz_completed",
        title: "Finished a 25-question quiz",
        score: 75,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
    ];
  }, []);

  // Calculate blueprint coverage
  const blueprintCoverage = useMemo(() => {
    const totalAnswered = mockDomainStats.reduce((sum, stat) => sum + stat.questionsAnswered, 0);
    const totalPossible = mockDomainStats.reduce((sum, stat) => sum + stat.totalQuestions, 0);
    return totalPossible > 0 ? Math.round((totalAnswered / totalPossible) * 100) : 0;
  }, [mockDomainStats]);

  // Show loading state
  if (!user || loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: colorSemantic.background.default }}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div style={{ color: colorSemantic.text.muted }}>
              {!user ? "Loading..." : "Loading dashboard..."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: colorSemantic.background.default }}>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div
              className="rounded-lg p-6 text-center border"
              style={{
                backgroundColor: colorSemantic.error.light,
                borderColor: colorSemantic.error.base + "40",
              }}
            >
              <h2
                className="text-lg font-semibold mb-2"
                style={{ color: colorSemantic.error.dark }}
              >
                Error Loading Dashboard
              </h2>
              <p className="mb-4" style={{ color: colorSemantic.error.base }}>
                {error}
              </p>
              <Button onClick={() => window.location.reload()} tone="danger">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show dashboard content
  if (!dashboardData) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: colorSemantic.background.default }}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div style={{ color: colorSemantic.text.muted }}>No dashboard data available</div>
          </div>
        </div>
      </div>
    );
  }

  // Get variant-specific content for banner
  const variantContent = getBetaVariantContent(betaVariant);

  return (
    <DashboardLayout
      sidebar={
        <DashboardSidebar
          activeItem="dashboard"
          showUpgradeCTA={accessLevel !== "SUBSCRIBER"}
          onUpgrade={() => startBasicCheckout("dashboard_sidebar")}
        />
      }
      main={
        <div className="space-y-6">
          {/* Beta Diagnostic Banner */}
          {showBetaBanner && (
            <div className="mb-6">
              <div
                className="rounded-lg p-4 border flex items-center justify-between"
                style={{
                  backgroundColor: colorSemantic.info.light,
                  borderColor: colorSemantic.info.base + "40",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{betaVariant === 'B' ? '🎁' : '🎯'}</div>
                  <div>
                    <p className="font-medium" style={{ color: colorSemantic.info.dark }}>
                      {variantContent.skipBanner.message}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleStartDiagnostic}
                    size="sm"
                    tone="accent"
                    data-testid="dashboard-beta-start-btn"
                  >
                    {variantContent.skipBanner.cta}
                  </Button>
                  <Button
                    onClick={handleDismissBanner}
                    variant="ghost"
                    size="sm"
                    tone="neutral"
                    className="size-8 p-1"
                    aria-label="Dismiss beta banner"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <DashboardHeader
            onStartPractice={handleStartPractice}
            onReviewWeakest={handleReviewWeakest}
          />

          {/* Readiness Snapshot Card */}
          <ReadinessSnapshotCard
            score={examReadiness?.currentReadinessScore ?? 0}
            hasCompletedDiagnostic={examReadiness?.hasCompletedDiagnostic ?? false}
            overallAccuracy={dashboardData.practice.accuracyPercentage}
            blueprintCoverage={blueprintCoverage}
            weakestDomain={weakestDomain?.displayName}
            weakestDomainWeight={weakestDomain ? (() => {
              const domain = PMLE_BLUEPRINT.find((d) => d.domainCode === weakestDomain.domainCode);
              return domain ? Math.round(domain.weight * 100) : undefined;
            })() : undefined}
            onStartDiagnostic={handleStartDiagnostic}
            onUpgrade={() => startBasicCheckout("dashboard_readiness_card")}
            showUpgradeCTA={accessLevel !== "SUBSCRIBER"}
          />

          {/* Exam Blueprint Table */}
          <ExamBlueprintTable domainStats={mockDomainStats} />
        </div>
      }
      rightPanel={
        <div className="space-y-6">
          {/* Next Best Step Card */}
          {weakestDomain && (
            <NextBestStepCard
              domain={weakestDomain.displayName}
              questionCount={25}
              estimatedTime="30 mins"
              onStartSession={() => {
                window.location.href = `/practice/question?domain=${encodeURIComponent(weakestDomain.displayName)}`;
              }}
              onChooseAnotherMode={() => {
                window.location.href = '/practice/question';
              }}
            />
          )}

          {/* Recent Activity List */}
          <RecentActivityList activities={mockActivities} />
        </div>
      }
    />
  );
};

export default DashboardPage;
