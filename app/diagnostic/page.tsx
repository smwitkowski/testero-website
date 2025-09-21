"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider"; // Assuming this is still relevant for logged-in users
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import {
  getAnonymousSessionId,
  setAnonymousSessionId,
  generateAnonymousSessionId,
} from "@/lib/auth/anonymous-session";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, Target, BarChart3, BookOpen } from "lucide-react";

interface ExamTypeOption {
  name: string; // This will be the value sent to the API (e.g., "Google Professional ML Engineer")
  displayName: string; // This will be shown in the dropdown (e.g., "Google ML Engineer")
}

const DiagnosticStartPage = () => {
  const [examTypes, setExamTypes] = useState<ExamTypeOption[]>([]);
  const [selectedExamName, setSelectedExamName] = useState<string>(""); // Store the 'name' field for API
  const [numQuestions, setNumQuestions] = useState(20); // Default to full diagnostic
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeSession, setResumeSession] = useState<{
    sessionId: string;
    examType: string;
    startedAt: string;
  } | null>(null);
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth(); // Keep auth for logged-in user tracking
  const posthog = usePostHog();

  useEffect(() => {
    // Fetch exam types - this part does not require authentication as per new requirements
    const fetchExamTypes = async () => {
      try {
        // This endpoint needs to be created or use an existing one that lists exams
        // For now, let's assume a simple GET to /api/exams (needs implementation)
        // Or, for MVP, we can hardcode them if an API endpoint is too much scope now
        // Based on previous DB query, we have:
        const fetchedExams: ExamTypeOption[] = [
          { name: "Google Professional Machine Learning Engineer", displayName: "PMLE - Professional ML Engineer (October 2024)" },
          { name: "Google Cloud Digital Leader", displayName: "Google Cloud Digital Leader" },
          {
            name: "Google Cloud Professional Cloud Architect",
            displayName: "Google Cloud Architect",
          },
          // Add others if needed
        ];
        setExamTypes(fetchedExams);
        if (fetchedExams.length > 0) {
          setSelectedExamName(fetchedExams[0].name); // Default to first exam
        }
      } catch (err) {
        console.error("Failed to fetch exam types", err);
        setError("Could not load exam types.");
        // Fallback to a default if fetch fails
        const fallbackExams: ExamTypeOption[] = [
          { name: "Google Professional Machine Learning Engineer", displayName: "PMLE - Professional ML Engineer (October 2024)" },
        ];
        setExamTypes(fallbackExams);
        setSelectedExamName(fallbackExams[0].name);
      }
    };
    fetchExamTypes();
  }, []);

  useEffect(() => {
    // Check for unfinished session on page load
    const checkUnfinishedSession = async () => {
      if (isAuthLoading) return; // Wait for auth state to load

      const storedSessionId = localStorage.getItem("testero_diagnostic_session_id");
      if (!storedSessionId) return;

      try {
        let statusUrl = `/api/diagnostic/session/${storedSessionId}/status`;

        // Include anonymous session ID if user is not logged in
        if (!user) {
          const anonymousSessionId = getAnonymousSessionId();
          if (anonymousSessionId) {
            statusUrl += `?anonymousSessionId=${anonymousSessionId}`;
          }
        }

        const response = await fetch(statusUrl);
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }
        const data = (await response.json()) as {
          exists?: boolean;
          status?: string;
          examType?: string;
          startedAt?: string;
        };

        if (data.exists && data.status === "active" && data.examType && data.startedAt) {
          setResumeSession({
            sessionId: storedSessionId,
            examType: data.examType,
            startedAt: data.startedAt,
          });

          // Track resume opportunity shown
          trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_RESUME_SHOWN, {
            sessionId: storedSessionId,
            examType: data.examType,
            startedAt: data.startedAt,
          });
        } else if (
          data.status === "completed" ||
          data.status === "expired" ||
          data.status === "not_found"
        ) {
          // Clean up localStorage for completed/expired/not found sessions
          localStorage.removeItem("testero_diagnostic_session_id");
        }
      } catch (err) {
        console.error("Error checking session status:", err);
        // Clean up localStorage on error
        localStorage.removeItem("testero_diagnostic_session_id");
      }
    };

    checkUnfinishedSession();
  }, [user, isAuthLoading, posthog]);

  // No longer forcing login for this page
  // useEffect(() => {
  //   if (!isAuthLoading && !user) {
  //     router.push('/login');
  //   }
  // }, [user, isAuthLoading, router]);

  const handleResumeSession = () => {
    if (resumeSession) {
      // Track resume action
      trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_RESUMED, {
        sessionId: resumeSession.sessionId,
        examType: resumeSession.examType,
        startedAt: resumeSession.startedAt,
      });

      router.push(`/diagnostic/${resumeSession.sessionId}`);
    }
  };

  const handleStartOver = () => {
    // Clear stored session data
    localStorage.removeItem("testero_diagnostic_session_id");
    setResumeSession(null);
  };

  const handleStartDiagnostic = async () => {
    if (!selectedExamName) {
      setError("Please select a valid exam type.");
      return;
    }

    if (!numQuestions || numQuestions < 1 || numQuestions > 30) {
      setError("Please select between 1 and 30 questions.");
      return;
    }

    setLoading(true);
    setError(null);

    const requestBody: {
      action: "start";
      data: { examType: string; numQuestions: number; anonymousSessionId?: string };
    } = {
      action: "start",
      data: {
        examType: selectedExamName, // Send the 'name' field
        numQuestions,
      },
    };

    // For anonymous users, try to send existing anonymousSessionId for potential resume
    if (!user) {
      let anonymousSessionId = getAnonymousSessionId();
      if (!anonymousSessionId) {
        // Generate new anonymous session ID if none exists
        anonymousSessionId = generateAnonymousSessionId();
        setAnonymousSessionId(anonymousSessionId);
      }
      requestBody.data.anonymousSessionId = anonymousSessionId;
    }

    try {
      const res = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const responseData = (await res.json()) as {
        error?: string;
        sessionId?: string;
        anonymousSessionId?: string;
      };
      if (!res.ok) {
        // Error handling remains similar, but 429 (too many sessions) is removed
        // 401 might still occur if a logged-in user's token expires, but not for anonymous
        if (res.status === 401 && user) {
          // Only redirect to login if it was an auth issue for a logged-in user
          setError("Authentication issue. Please log in again.");
          router.replace("/login");
        } else {
          setError(responseData.error || "Failed to start diagnostic.");
        }
        return;
      }

      // If API returns a new anonymousSessionId (for new anonymous sessions), store it
      if (responseData.anonymousSessionId && !user) {
        setAnonymousSessionId(responseData.anonymousSessionId);
      }

      // Store diagnostic session ID in localStorage for session persistence
      if (responseData.sessionId) {
        localStorage.setItem("testero_diagnostic_session_id", responseData.sessionId);
      }

      // Track diagnostic started
      trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_STARTED, {
        sessionId: responseData.sessionId,
        examType: selectedExamName,
        questionCount: numQuestions,
        userId: user?.id || null,
        isAnonymous: !user,
      });

      // If it was a resumed session, the API might indicate it. For now, just redirect.
      if (responseData.sessionId) {
        router.push(`/diagnostic/${responseData.sessionId}`);
      } else {
        setError("Failed to start diagnostic session");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Determine if the main button should be disabled
  // Auth loading is relevant if a user *might* be logged in.
  // If strictly anonymous, isAuthLoading might not be as critical here,
  // but keeping it for cases where a user *is* logged in.
  const isButtonDisabled = loading || (user && isAuthLoading) || examTypes.length === 0;

  return (
    <main className="max-w-2xl mx-auto my-8 px-4">
      <Card className="border-slate-200 shadow-sm p-6 md:p-7">
        <CardHeader className="p-0 mb-6">
          <div className="flex justify-end mb-4">
            <Badge variant="soft" tone="accent" size="sm">
              Updated Oct 2024 exam changes
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            PMLE Diagnostic
          </h1>
          <p className="text-lg text-slate-600 mb-4">
            10-minute readiness check. Updated for Oct &apos;24 changes.
          </p>
          <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 text-slate-700 text-sm">
              <BarChart3 className="w-4 h-4" />
              6 domains
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 text-slate-700 text-sm">
              <Target className="w-4 h-4" />
              Vertex AI Model Garden
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 text-slate-700 text-sm">
              <BookOpen className="w-4 h-4" />
              GenAI & RAG
            </div>
          </div>
        </CardHeader>

        {resumeSession && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold text-blue-700 mb-3">Unfinished Diagnostic Found</h2>
              <p className="text-sm text-blue-600 mb-2">
                You have an unfinished <strong>{resumeSession.examType}</strong> diagnostic started on{" "}
                {new Date(resumeSession.startedAt).toLocaleString()}.
              </p>
              <p className="text-sm text-blue-600 mb-4">Would you like to resume or start over?</p>
              <div className="flex gap-3">
                <Button onClick={handleResumeSession} tone="accent" size="sm">
                  Resume
                </Button>
                <Button
                  onClick={handleStartOver}
                  variant="outline"
                  tone="accent"
                  size="sm"
                >
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <CardContent className="space-y-6">
          {!user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 m-0">
                💡 <strong>No signup required!</strong> Take the diagnostic anonymously and get instant results.
                Create an account later to save your progress and access personalized study plans.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="examType" className="text-sm font-medium text-slate-700">
                Certification Exam
              </Label>
              <select
                id="examType"
                value={selectedExamName}
                onChange={(e) => setSelectedExamName(e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={examTypes.length === 0}
                aria-describedby="exam-helper-text"
              >
                {examTypes.length === 0 && <option>Loading exams...</option>}
                {examTypes.map((exam) => (
                  <option key={exam.name} value={exam.name}>
                    {exam.displayName}
                  </option>
                ))}
              </select>
              <p id="exam-helper-text" className="text-xs text-slate-500">Search or pick an exam</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Diagnostic Length
              </Label>
              <div className="flex gap-2" role="group" aria-labelledby="question-count-label">
                {[10, 20, 30].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumQuestions(count)}
                    aria-pressed={numQuestions === count}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      numQuestions === count
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                <strong>Recommended: 20 questions</strong> for comprehensive assessment (10 minutes)
              </p>
            </div>
            <Button
              onClick={handleStartDiagnostic}
              disabled={isButtonDisabled}
              fullWidth
              size="lg"
              tone="accent"
              className="mt-2"
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              {user && isAuthLoading ? "Loading user..." : loading ? "Starting..." : (
                <>Start free diagnostic</>
              )}
            </Button>
            {error && (
              <div className="text-red-600 text-sm mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <BarChart3 className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                <p className="text-sm text-slate-700 font-medium">Instant score</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <Target className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                <p className="text-sm text-slate-700 font-medium">Find weak areas</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <BookOpen className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                <p className="text-sm text-slate-700 font-medium">Get a study plan</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

// Note: Question limits are now handled by the pill selection (10, 20, 30)

export default DiagnosticStartPage;
