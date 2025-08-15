"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ReadinessMeter } from "@/components/dashboard/ReadinessMeter";
import { DiagnosticSummary } from "@/components/dashboard/DiagnosticSummary";
import { PracticeSummary } from "@/components/dashboard/PracticeSummary";
import { Button } from "@/components/ui/button";
import { colorSemantic } from "@/lib/design-system";
import { usePostHog } from "posthog-js/react";
import { X } from "lucide-react";

// Import types from the API route
import type { DashboardData, SuccessResponse, ErrorResponse } from "@/app/api/dashboard/route";

// Import beta onboarding constants
import { FEATURE_FLAGS, getBetaVariantContent } from "@/lib/constants/beta-onboarding";

const DashboardPage = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBetaBanner, setShowBetaBanner] = useState(false);
  const [betaVariant, setBetaVariant] = useState<'A' | 'B'>('A');
  const posthog = usePostHog();

  // Track dashboard page view (middleware ensures auth)
  useEffect(() => {
    if (user) {
      posthog?.capture("dashboard_viewed", {
        user_id: user.id,
      });
    }
  }, [user, posthog]);

  // Check if we should show the beta banner
  useEffect(() => {
    if (FEATURE_FLAGS.BETA_ONBOARDING_FLOW) {
      const urlParams = new URLSearchParams(window.location.search);
      const fromBetaWelcome = urlParams.get('from') === 'beta_welcome';
      const variant = urlParams.get('beta_variant') as 'A' | 'B' | null;
      const dismissed = localStorage.getItem('beta_diagnostic_banner_dismissed');
      
      if (variant) {
        setBetaVariant(variant === 'B' ? 'B' : 'A');
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

  const handleDismissBanner = () => {
    setShowBetaBanner(false);
    localStorage.setItem('beta_diagnostic_banner_dismissed', 'true');
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
          source: 'dashboard_banner',
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
              <Button onClick={() => window.location.reload()} variant="destructive">
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
    <div className="min-h-screen" style={{ backgroundColor: colorSemantic.background.default }}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
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
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {variantContent.skipBanner.cta}
                  </Button>
                  <Button
                    onClick={handleDismissBanner}
                    variant="ghost"
                    size="sm"
                    className="p-1 h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: colorSemantic.text.primary }}>
              Dashboard
            </h1>
            <p style={{ color: colorSemantic.text.secondary }}>
              Track your progress and exam readiness
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Readiness Meter - Full width on mobile, spans 2 cols on desktop */}
            <div className="lg:col-span-2">
              <ReadinessMeter score={dashboardData.readinessScore} className="h-full" />
            </div>

            {/* Practice Summary */}
            <div className="lg:col-span-1">
              <PracticeSummary stats={dashboardData.practice} className="h-full" />
            </div>

            {/* Diagnostic Summary - Full width */}
            <div className="lg:col-span-3">
              <DiagnosticSummary
                sessions={dashboardData.diagnostic.recentSessions}
                totalSessions={dashboardData.diagnostic.totalSessions}
              />
            </div>
          </div>

          {/* Additional Info/Tips Section */}
          {dashboardData.readinessScore === 0 && (
            <div
              className="mt-8 rounded-lg p-6 border"
              style={{
                backgroundColor: colorSemantic.info.light,
                borderColor: colorSemantic.info.base + "40",
              }}
            >
              <h3 className="text-lg font-semibold mb-2" style={{ color: colorSemantic.info.dark }}>
                Get Started with Your Study Journey
              </h3>
              <p className="mb-4" style={{ color: colorSemantic.info.base }}>
                Welcome to your dashboard! To get the most accurate readiness assessment:
              </p>
              <ul
                className="space-y-1 text-sm list-disc list-inside"
                style={{ color: colorSemantic.info.base }}
              >
                <li>Take a diagnostic test to assess your current knowledge</li>
                <li>Practice regularly with our question bank</li>
                <li>Track your progress over time</li>
                <li>Focus on areas where you need improvement</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
