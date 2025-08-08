"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import {
  ScoreChart,
  DomainBreakdown,
  QuestionReview,
  StudyRecommendations,
  type SessionSummary,
  type DomainBreakdownType,
} from "@/components/diagnostic";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DiagnosticSummaryPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const posthog = usePostHog();
  const sessionId = params?.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [domainBreakdown, setDomainBreakdown] = useState<DomainBreakdownType[]>([]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!sessionId) {
        setError("Session ID not found");
        setLoading(false);
        return;
      }

      if (isAuthLoading) {
        return; // Wait for auth state
      }

      try {
        let apiUrl = `/api/diagnostic/summary/${sessionId}`;

        // Include anonymous session ID if user is not logged in
        if (!user) {
          const anonymousSessionId = localStorage.getItem("anonymousSessionId");
          if (anonymousSessionId) {
            apiUrl += `?anonymousSessionId=${anonymousSessionId}`;
          }
        }

        const response = await fetch(apiUrl);
        const data = (await response.json()) as {
          error?: string;
          summary?: SessionSummary;
          domainBreakdown?: DomainBreakdownType[];
        };

        if (!response.ok) {
          if (response.status === 404) {
            setError("session_not_found");
          } else if (response.status === 403) {
            setError("access_denied");
          } else if (response.status === 400) {
            setError("session_not_completed");
          } else {
            setError(data.error || "Failed to load summary");
          }
          return;
        }

        if (data.summary) {
          setSummary(data.summary);
        }
        setDomainBreakdown(data.domainBreakdown || []);

        // Track summary view
        if (data.summary) {
          posthog?.capture("diagnostic_summary_viewed", {
            sessionId: data.summary.sessionId,
            examType: data.summary.examType,
            score: data.summary.score,
            totalQuestions: data.summary.totalQuestions,
            correctAnswers: data.summary.correctAnswers,
            domainCount: data.domainBreakdown?.length || 0,
          });
        }

        // Clean up localStorage since session is completed
        localStorage.removeItem("testero_diagnostic_session_id");
      } catch (err) {
        console.error("Error fetching summary:", err);
        setError("Failed to load diagnostic summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [sessionId, user, isAuthLoading, posthog]);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center">Loading diagnostic summary...</div>
      </main>
    );
  }

  if (error === "session_not_found") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Summary Not Found</h1>
            <p className="text-red-600 mb-6">
              The diagnostic session could not be found or may have expired.
            </p>
            <Button onClick={() => router.push("/diagnostic")}>Start New Diagnostic</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error === "access_denied") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="text-red-600 mb-6">
              You don&apos;t have permission to view this diagnostic summary.
            </p>
            <Button onClick={() => router.push("/diagnostic")}>Start New Diagnostic</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error === "session_not_completed") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Diagnostic Not Completed</h1>
            <p className="text-red-600 mb-6">
              This diagnostic session hasn&apos;t been completed yet.
            </p>
            <Button onClick={() => router.push(`/diagnostic/${sessionId}`)}>
              Continue Diagnostic
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Error</h1>
            <p className="text-red-600 mb-6">{error}</p>
            <Button onClick={() => router.push("/diagnostic")}>Start New Diagnostic</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center">No summary data available</div>
      </main>
    );
  }

  const incorrectQuestions = summary.questions.filter((q) => !q.isCorrect);

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Diagnostic Results</h1>

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="flex items-center justify-center">
          <ScoreChart score={summary.score} size="lg" showStatus={true} />
        </div>
        <Card className="col-span-2">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Overview</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">
                  {summary.correctAnswers}/{summary.totalQuestions}
                </div>
                <div className="text-gray-600">Correct Answers</div>
              </div>
              <div>
                <div className="text-xl font-bold">{summary.examType}</div>
                <div className="text-gray-600">Exam Type</div>
              </div>
              <div>
                <div className="text-lg">{new Date(summary.completedAt).toLocaleDateString()}</div>
                <div className="text-gray-600">Completed</div>
              </div>
              <div>
                <div className="text-lg">
                  {Math.round(
                    (new Date(summary.completedAt).getTime() -
                      new Date(summary.startedAt).getTime()) /
                      60000
                  )}{" "}
                  min
                </div>
                <div className="text-gray-600">Duration</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Breakdown */}
      {domainBreakdown.length > 0 && (
        <div className="mb-8">
          <DomainBreakdown domains={domainBreakdown} />
        </div>
      )}

      {/* Study Recommendations */}
      <div className="mb-8">
        <StudyRecommendations
          score={summary.score}
          domainBreakdown={domainBreakdown}
          incorrectQuestions={incorrectQuestions}
        />
      </div>

      {/* Question Review */}
      <div className="mb-8">
        <QuestionReview questions={summary.questions} expandable={true} />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button onClick={() => router.push("/diagnostic")} size="lg">
          Take Another Diagnostic
        </Button>
        <Button
          onClick={() => {
            // Store diagnostic data for study path page
            if (summary && domainBreakdown) {
              const diagnosticData = {
                score: summary.score,
                domains: domainBreakdown,
              };
              sessionStorage.setItem("diagnosticData", JSON.stringify(diagnosticData));
            }

            // Navigate to study path page
            router.push("/study-path");
          }}
          size="lg"
          variant="default"
          className="bg-green-600 hover:bg-green-700"
        >
          Start My Study Path
        </Button>
      </div>
    </main>
  );
};

export default DiagnosticSummaryPage;
