"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPmleDomainConfig } from "@/lib/constants/pmle-blueprint";

interface QuestionSummary {
  id: string;
  stem: string;
  options: Array<{ label: string; text: string }>;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string | null;
  domain: string | null;
}

interface DomainBreakdown {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

interface PracticeSummary {
  sessionId: string;
  exam: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  startedAt: string;
  completedAt: string;
  source?: string;
  sourceSessionId?: string;
  questions: QuestionSummary[];
}

const PracticeSummaryPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const posthog = usePostHog();
  const sessionId = params?.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [domainBreakdown, setDomainBreakdown] = useState<DomainBreakdown[]>([]);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

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

      if (!user) {
        setError("authentication_required");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/practice/session/${sessionId}/summary`);
        const data = (await response.json()) as {
          error?: string;
          summary?: PracticeSummary;
          domainBreakdown?: DomainBreakdown[];
        };

        if (!response.ok) {
          if (response.status === 404) {
            setError("session_not_found");
          } else if (response.status === 403) {
            setError("access_denied");
          } else if (response.status === 400) {
            setError("session_not_completed");
          } else if (response.status === 401) {
            setError("authentication_required");
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
          trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_SESSION_SUMMARY_VIEWED, {
            sessionId: data.summary.sessionId,
            exam: data.summary.exam,
            score: data.summary.score,
            totalQuestions: data.summary.totalQuestions,
            correctAnswers: data.summary.correctAnswers,
            domainCount: data.domainBreakdown?.length || 0,
          });
        }
      } catch (err) {
        console.error("Error fetching summary:", err);
        setError("Failed to load practice summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [sessionId, user, isAuthLoading, posthog]);

  const toggleExpanded = useCallback((questionId: string) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }, []);

  const handlePracticeAgain = useCallback(() => {
    if (summary?.sourceSessionId) {
      // If this practice session came from a diagnostic, offer to create a new practice session
      router.push(`/diagnostic/${summary.sourceSessionId}/summary`);
    } else {
      // Otherwise, go to dashboard
      router.push("/dashboard");
    }
  }, [summary, router]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-600">Loading practice summary...</div>
      </div>
    );
  }

  // Error states
  if (error === "session_not_found") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Summary Not Found</h1>
            <p className="text-red-600 mb-6">
              The practice session could not be found or may have expired.
            </p>
            <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
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
              You don&apos;t have permission to view this practice summary.
            </p>
            <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
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
            <h1 className="text-2xl font-bold mb-4">Session Not Completed</h1>
            <p className="text-red-600 mb-6">This practice session hasn&apos;t been completed yet.</p>
            <Button onClick={() => router.push(`/practice/session/${sessionId}`)}>
              Continue Practice Session
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error === "authentication_required") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
            <p className="text-red-600 mb-6">You need to be logged in to view this summary.</p>
            <Button onClick={() => router.push("/login")}>Go to Login</Button>
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
            <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Practice Results</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {new Date(summary.completedAt).toLocaleDateString()} • {summary.exam}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Score Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className="text-6xl font-bold text-indigo-600 mb-2">{summary.score}%</div>
              <div className="text-lg text-slate-600">
                {summary.correctAnswers} out of {summary.totalQuestions} correct
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <Button onClick={handlePracticeAgain} tone="accent" size="md">
                Practice Again
              </Button>
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                tone="accent"
                size="md"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Domain Breakdown */}
        {domainBreakdown.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Domain Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {domainBreakdown
                  .sort((a, b) => a.percentage - b.percentage)
                  .map((domain) => (
                    <div key={domain.domain} className="p-3 rounded-lg bg-slate-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-900">{domain.domain}</span>
                        <span className="font-semibold text-slate-900">{domain.percentage}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 h-2 rounded">
                          <div
                            className="bg-indigo-600 h-2 rounded transition-all duration-300"
                            style={{ width: `${domain.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {domain.correct}/{domain.total}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question Review */}
        <Card>
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.questions.map((question, index) => {
                const isExpanded = expandedQuestions.has(question.id);
                return (
                  <div key={question.id} className="border border-slate-200 rounded-xl p-4">
                    {/* Question Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          question.isCorrect
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {question.isCorrect ? "✓ Correct" : "✗ Incorrect"}
                      </span>
                      {question.domain && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                          {question.domain}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 ml-auto">Question {index + 1}</span>
                    </div>

                    {/* Question Stem */}
                    <div className="text-sm text-slate-700 mb-3">{question.stem}</div>

                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleExpanded(question.id)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-2"
                    >
                      {isExpanded ? "Hide" : "View"} details
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 pt-4 mt-4 space-y-4">
                        {/* Options */}
                        <div>
                          <h4 className="font-medium text-slate-900 mb-2">Answer Choices:</h4>
                          <div className="space-y-2">
                            {question.options.map((option) => (
                              <div
                                key={option.label}
                                className={`p-2 rounded border ${
                                  option.label === question.correctAnswer
                                    ? "bg-green-50 border-green-200"
                                    : option.label === question.userAnswer
                                      ? "bg-red-50 border-red-200"
                                      : "bg-white border-slate-200"
                                }`}
                              >
                                <span className="font-medium">{option.label}:</span> {option.text}
                                {option.label === question.correctAnswer && (
                                  <span className="ml-2 text-green-600 text-sm">✓ Correct</span>
                                )}
                                {option.label === question.userAnswer &&
                                  option.label !== question.correctAnswer && (
                                    <span className="ml-2 text-red-600 text-sm">✗ Your answer</span>
                                  )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Explanation */}
                        {question.explanation ? (
                          <div>
                            <h4 className="font-medium text-slate-900 mb-2">Explanation:</h4>
                            <p className="text-slate-700">{question.explanation}</p>
                          </div>
                        ) : (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-700">
                              Explanation not available. Upgrade to Premium for detailed explanations.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PracticeSummaryPage;

