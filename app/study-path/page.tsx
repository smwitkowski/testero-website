"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StudyPathDisplay } from "@/components/study-path";
import { usePostHog } from "posthog-js/react";

interface DiagnosticData {
  score: number;
  domains: Array<{
    domain: string;
    correct: number;
    total: number;
    percentage: number;
  }>;
}

const StudyPathPage = () => {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);
  const posthog = usePostHog();

  // Track page view
  useEffect(() => {
    posthog?.capture("study_path_viewed", {
      user_id: user?.id,
      is_authenticated: !!user,
    });
  }, [user, posthog]);

  useEffect(() => {
    try {
      // For now, get data from sessionStorage (minimal implementation)
      const storedData = sessionStorage.getItem("diagnosticData");
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          setDiagnosticData(parsedData);

          // Track study path generated from diagnostic data
          posthog?.capture("study_path_generated", {
            user_id: user?.id,
            diagnostic_score: parsedData.score,
            domains_count: parsedData.domains?.length || 0,
            weak_areas:
              parsedData.domains
                ?.filter((d: { percentage: number; domain: string }) => d.percentage < 60)
                .map((d: { percentage: number; domain: string }) => d.domain) || [],
            strong_areas:
              parsedData.domains
                ?.filter((d: { percentage: number; domain: string }) => d.percentage >= 80)
                .map((d: { percentage: number; domain: string }) => d.domain) || [],
            performance_tier:
              parsedData.score < 40
                ? "foundation"
                : parsedData.score < 60
                  ? "good"
                  : parsedData.score < 80
                    ? "strong"
                    : "excellent",
          });
        } catch (error) {
          // Structured logging for JSON parse errors
          console.error("[StudyPath Page] Failed to parse diagnostic data:", {
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
            dataLength: storedData.length,
            preview: storedData.substring(0, 100) + "...",
          });
          // Clear corrupted data from storage
          sessionStorage.removeItem("diagnosticData");

          // Track error
          posthog?.capture("study_path_error", {
            user_id: user?.id,
            error_type: "parse_error",
            error_message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    } catch (error) {
      // Handle sessionStorage access errors (e.g., in private browsing mode)
      console.error("[StudyPath Page] Failed to access sessionStorage:", {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        context: "private browsing or storage disabled",
      });

      // Track storage error
      posthog?.capture("study_path_error", {
        user_id: user?.id,
        error_type: "storage_access_error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [user, posthog]);

  // Score threshold constants for clear performance tiers
  const SCORE_THRESHOLD_FOUNDATION = 40;
  const SCORE_THRESHOLD_GOOD = 60;
  const SCORE_THRESHOLD_STRONG = 80;

  // Determine message based on score
  const getScoreMessage = (score: number) => {
    if (score < SCORE_THRESHOLD_FOUNDATION) {
      return {
        title: "Foundation Building",
        message: "Let's focus on building strong fundamentals in key areas.",
      };
    } else if (score < SCORE_THRESHOLD_GOOD) {
      return {
        title: "Good Progress",
        message: "You're making solid progress. Let's strengthen weak areas.",
      };
    } else if (score < SCORE_THRESHOLD_STRONG) {
      return {
        title: "Strong Performance",
        message: "Great job! Let's fine-tune your knowledge for exam readiness.",
      };
    } else {
      return {
        title: "Excellent Performance",
        message: "Outstanding! Maintain your edge with targeted practice.",
      };
    }
  };

  const scoreMessage = diagnosticData ? getScoreMessage(diagnosticData.score) : null;

  // Handle authentication states
  if (isAuthLoading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center">Loading...</div>
      </main>
    );
  }

  // If user is not authenticated, show login prompt but still display data
  if (!user) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-8">Your Personalized Study Path</h1>

        {/* Show diagnostic data if available */}
        {diagnosticData && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Your Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-blue-600">{diagnosticData.score}%</div>
                  <div className="text-gray-600">Overall Score</div>
                </div>
                {scoreMessage && (
                  <div className="text-center p-4 rounded-lg bg-gray-50">
                    <h3 className="text-xl font-semibold mb-2">{scoreMessage.title}</h3>
                    <p className="text-gray-600">{scoreMessage.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Login prompt */}
        <Card className="mb-6">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold mb-4">
              Sign in to access your personalized study path
            </h2>
            <p className="text-gray-600 mb-6">
              Create an account or sign in to save your progress and get tailored recommendations.
            </p>
            <Button
              onClick={() => {
                posthog?.capture("study_path_signin_clicked", {
                  has_diagnostic_data: !!diagnosticData,
                  diagnostic_score: diagnosticData?.score,
                });
                router.push("/login?redirect=/study-path");
              }}
              size="lg"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Authenticated user view
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Personalized Study Path</h1>

      {diagnosticData && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Your Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-blue-600">{diagnosticData.score}%</div>
                <div className="text-gray-600">Overall Score</div>
              </div>
              {scoreMessage && (
                <div className="text-center p-4 rounded-lg bg-gray-50">
                  <h3 className="text-xl font-semibold mb-2">{scoreMessage.title}</h3>
                  <p className="text-gray-600">{scoreMessage.message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Domain Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {diagnosticData.domains.map((domain) => (
                <div key={domain.domain} className="mb-4 p-3 rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">{domain.domain}</h4>
                    <span className="font-semibold">{domain.percentage}%</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {domain.correct} out of {domain.total} correct
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Study Path Recommendations */}
      {diagnosticData ? (
        <StudyPathDisplay diagnosticData={diagnosticData} />
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Study Path</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Complete a diagnostic test to get personalized study recommendations.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default StudyPathPage;
