"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";

interface Option {
  label: string;
  text: string;
}

interface QuestionData {
  id: number;
  stem: string;
  options: Option[];
}

interface DiagnosticSessionData {
  id: string;
  userId: string;
  examType: string;
  questions: QuestionData[];
  answers: Record<number, string>;
  startedAt: string;
  currentQuestion: number;
}

const DiagnosticSessionPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const posthog = usePostHog();
  const sessionId = params?.sessionId as string;

  const [sessionData, setSessionData] = useState<DiagnosticSessionData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFlagged, setIsFlagged] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        setError("Session ID not found in URL.");
        setLoading(false);
        return;
      }
      if (isAuthLoading) {
        setLoading(true);
        return;
      }

      setLoading(true);
      setError(null);

      let apiUrl = `/api/diagnostic?sessionId=${sessionId}`;
      if (!user) {
        const storedAnonId = localStorage.getItem("anonymousSessionId");
        if (storedAnonId) {
          apiUrl += `&anonymousSessionId=${storedAnonId}`;
        }
      }

      try {
        const res = await fetch(apiUrl);
        const data = (await res.json()) as { error?: string; session?: DiagnosticSessionData };
        if (!res.ok) {
          if (res.status === 404) {
            setError("session_not_found");
          } else if (res.status === 410) {
            setError("session_expired");
          } else if (res.status === 401) {
            setError("authentication_required");
          } else if (res.status === 403) {
            setError("access_denied_to_session");
          } else {
            setError(data.error || "Failed to fetch diagnostic session.");
          }
          return;
        }
        if (data.session) {
          setSessionData(data.session);
        }

        trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_STARTED, {
          sessionId: sessionId,
          examType: data.session?.examType || "unknown",
          questionCount: data.session?.questions?.length || 0,
          userId: user?.id || null,
          isAnonymous: !user,
        });

        setCurrentQuestionIndex(0);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred while fetching session.");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, user, isAuthLoading, posthog]);

  const currentQuestion = sessionData?.questions[currentQuestionIndex];

  const handleNextQuestion = useCallback(async () => {
    setSelectedOptionLabel(null);
    setIsFlagged(false);
    if (sessionData && currentQuestionIndex < sessionData.questions.length - 1) {
      setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
    } else {
      // All questions answered, complete the session
      setLoading(true);
      try {
        const res = await fetch("/api/diagnostic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            sessionId,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch results.");
        }

        trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_COMPLETED, {
          sessionId: sessionId,
          examType: sessionData?.examType,
          totalQuestions: sessionData?.questions.length || 0,
          userId: user?.id || null,
          isAnonymous: !user,
        });

        localStorage.removeItem("testero_diagnostic_session_id");
        router.push(`/diagnostic/${sessionId}/summary`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
  }, [sessionData, currentQuestionIndex, sessionId, posthog, user, router]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion || selectedOptionLabel === null) return;

    // Track the question answered event immediately
    trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_QUESTION_ANSWERED, {
      sessionId: sessionId,
      questionNumber: currentQuestionIndex + 1,
      totalQuestions: sessionData?.questions.length || 0,
      questionId: currentQuestion.id,
      selectedAnswer: selectedOptionLabel,
      examType: sessionData?.examType,
      userId: user?.id || null,
      isAnonymous: !user,
    });

    // Submit answer in background - don't await this
    fetch("/api/diagnostic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "answer",
        sessionId,
        data: {
          questionId: currentQuestion.id,
          selectedLabel: selectedOptionLabel,
        },
      }),
    }).catch((err) => {
      // Log error but don't block the UI
      console.error("Failed to submit answer:", err);
    });

    // Immediately advance to next question
    handleNextQuestion();
  }, [currentQuestion, selectedOptionLabel, sessionId, currentQuestionIndex, sessionData, posthog, user, handleNextQuestion]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!sessionData) return;

    const currentQuestion = sessionData.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const options = currentQuestion.options;
    const currentIndex = selectedOptionLabel ? 
      options.findIndex(opt => opt.label === selectedOptionLabel) : -1;

    switch (event.key) {
      case 'ArrowDown':
      case 'j':
        event.preventDefault();
        const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        setSelectedOptionLabel(options[nextIndex].label);
        break;
      case 'ArrowUp':
      case 'k':
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        setSelectedOptionLabel(options[prevIndex].label);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedOptionLabel) {
          handleSubmitAnswer();
        }
        break;
    }
  }, [sessionData, currentQuestionIndex, selectedOptionLabel, handleSubmitAnswer]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);


  const handleSkip = useCallback(() => {
    // Simply advance to next question without submitting answer
    handleNextQuestion();
  }, [handleNextQuestion]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-600">Loading diagnostic...</div>
      </div>
    );

  // Other error cases (keeping existing structure but with updated styles)
  if (error) {
    // Access denied
    if (error === "access_denied_to_session") {
      return (
        <main className="max-w-2xl mx-auto my-8 p-6 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-semibold mb-4">Access Denied</h1>
          <div className="mb-6">
            <p className="text-red-600 mb-4">
              You do not have permission to access this diagnostic session, or the session identifier
              is invalid.
            </p>
          </div>
          <button
            onClick={() => router.push("/diagnostic")}
            className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Start New Diagnostic
          </button>
        </main>
      );
    }

    // Session not found
    if (error === "session_not_found") {
      return (
        <main className="max-w-2xl mx-auto my-8 p-6 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-semibold mb-4">Session Not Found</h1>
          <div className="mb-6">
            <p className="text-red-600 mb-4">
              Your diagnostic session has expired or could not be found. This can happen if:
            </p>
            <ul className="text-slate-600 mb-6 space-y-1">
              <li>• The session expired due to inactivity</li>
              <li>• The server was restarted during development</li>
              <li>• The session ID is invalid</li>
            </ul>
            <p>Please start a new diagnostic test to continue.</p>
          </div>
          <button
            onClick={() => router.push("/diagnostic")}
            className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Start New Diagnostic
          </button>
        </main>
      );
    }

    // Session expired
    if (error === "session_expired") {
      return (
        <main className="max-w-2xl mx-auto my-8 p-6 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-semibold mb-4">Session Expired</h1>
          <div className="mb-6">
            <p className="text-red-600 mb-4">
              Your diagnostic session has expired after 30 minutes of inactivity for security
              reasons.
            </p>
            <p>Please start a new diagnostic test to continue.</p>
          </div>
          <button
            onClick={() => router.push("/diagnostic")}
            className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Start New Diagnostic
          </button>
        </main>
      );
    }

    // Authentication required
    if (error === "authentication_required") {
      return (
        <main className="max-w-2xl mx-auto my-8 p-6 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-semibold mb-4">Authentication Required</h1>
          <div className="mb-6">
            <p className="text-red-600 mb-4">
              You need to be logged in to access this diagnostic session.
            </p>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Go to Login
          </button>
        </main>
      );
    }

    // Generic error fallback
    return (
      <main className="max-w-2xl mx-auto my-8 p-6 border border-slate-200 rounded-lg">
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <div className="mb-6">
          <p className="text-red-600 mb-4">Error: {error}</p>
        </div>
        <button
          onClick={() => router.push("/diagnostic")}
          className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
        >
          Start New Diagnostic
        </button>
      </main>
    );
  }

  if (!currentQuestion)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-600">No questions found for this session.</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-white">
      {/* Top app bar with progress */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Diagnostic</h1>
          <div className="text-sm font-medium text-slate-600">
            Question {currentQuestionIndex + 1} of {sessionData?.questions.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div 
            className="h-1 bg-indigo-600 transition-all duration-300 ease-out"
            style={{ 
              width: `${((currentQuestionIndex + 1) / (sessionData?.questions.length || 1)) * 100}%` 
            }}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left rail - Desktop only */}
          <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-20">
            {/* Exam meta card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Progress</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Completed</span>
                  <span className="font-medium text-slate-900">
                    {currentQuestionIndex} / {sessionData?.questions.length || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(currentQuestionIndex / (sessionData?.questions.length || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Flag for review card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Review</h3>
              <button
                onClick={() => setIsFlagged(!isFlagged)}
                className={`w-full h-8 px-3 rounded-lg text-sm font-medium transition-colors ${
                  isFlagged
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-white text-slate-600 border border-slate-300 hover:border-slate-400'
                }`}
              >
                {isFlagged ? '🚩 Flagged' : 'Flag for review'}
              </button>
              <p className="text-xs text-slate-500 mt-2">
                Review all flagged questions before final submission.
              </p>
            </div>
          </aside>

          {/* Main column */}
          <div className="col-span-12 lg:col-span-9">
            {/* Question card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-6">
                Diagnostic Assessment
              </h2>
              
              {/* Question stem */}
              <div className="max-w-3xl mb-8">
                <div className="text-lg leading-relaxed text-slate-700">
                  {currentQuestion.stem}
                </div>
              </div>

              {/* Answer options - Radio group */}
              <div role="radiogroup" aria-label="Answer choices" className="space-y-3 mb-8">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedOptionLabel === option.label;
                  const labels = ['A', 'B', 'C', 'D'];

                  return (
                    <label
                      key={option.label}
                      className={`relative flex gap-3 rounded-xl border p-4 cursor-pointer transition shadow-sm ${
                        isSelected
                          ? 'border-indigo-600 ring-4 ring-indigo-600/10 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={option.label}
                        checked={isSelected}
                        onChange={() => setSelectedOptionLabel(option.label)}
                        className="sr-only"
                      />
                      
                      {/* A/B/C/D bubble */}
                      <div className={`w-8 h-8 rounded-full grid place-content-center text-sm font-medium flex-shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {labels[index]}
                      </div>
                      
                      {/* Option text */}
                      <div className="flex-1 text-slate-700 leading-relaxed">
                        {option.text}
                      </div>
                    </label>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Sticky bottom action bar */}
      <footer className="sticky bottom-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 justify-end">
          <button
            onClick={handleSkip}
            className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 hover:border-slate-400 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedOptionLabel === null}
            className={`h-10 px-5 rounded-lg font-medium shadow-sm transition-all ${
              selectedOptionLabel === null
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/30'
            }`}
          >
            Submit answer
          </button>
        </div>
      </footer>
    </div>
  );
};

export default DiagnosticSessionPage;