"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";

interface Option {
  label: string;
  text: string;
}

interface QuestionData {
  id: string;
  stem: string;
  options: Option[];
}

interface PracticeSessionData {
  id: string;
  userId: string;
  exam: string;
  questions: QuestionData[];
  startedAt: string;
  questionCount: number;
  source?: string;
  sourceSessionId?: string;
}

/**
 * Storage key for practice session progress
 */
function getProgressStorageKey(sessionId: string): string {
  return `testero_practice_progress_${sessionId}`;
}

/**
 * Storage key for tracking if session started event was fired
 */
function getStartedEventStorageKey(sessionId: string): string {
  return `testero_practice_started_${sessionId}`;
}

/**
 * Load progress from localStorage for a given session
 */
function loadProgress(sessionId: string): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const key = getProgressStorageKey(sessionId);
    const stored = localStorage.getItem(key);
    if (!stored) {
      return null;
    }
    const index = parseInt(stored, 10);
    return isNaN(index) ? null : index;
  } catch (error) {
    console.error("Failed to load progress from storage:", error);
    return null;
  }
}

/**
 * Save progress to localStorage for a given session
 */
function saveProgress(sessionId: string, index: number): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getProgressStorageKey(sessionId);
    localStorage.setItem(key, index.toString());
  } catch (error) {
    console.error("Failed to save progress to storage:", error);
  }
}

/**
 * Check if session started event was already fired
 */
function hasStartedEventFired(sessionId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const key = getStartedEventStorageKey(sessionId);
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

/**
 * Mark session started event as fired
 */
function markStartedEventFired(sessionId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getStartedEventStorageKey(sessionId);
    localStorage.setItem(key, "true");
  } catch (error) {
    console.error("Failed to mark started event as fired:", error);
  }
}

const PracticeSessionPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const posthog = usePostHog();
  const sessionId = params?.sessionId as string;

  const [sessionData, setSessionData] = useState<PracticeSessionData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionErrors, setSubmissionErrors] = useState<Set<string>>(new Set());
  const [retryQueue, setRetryQueue] = useState<
    Array<{ questionId: string; selectedLabel: string; attempts: number }>
  >([]);

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

      if (!user) {
        setError("authentication_required");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/practice/session/${sessionId}`);
        const data = (await res.json()) as { error?: string; session?: PracticeSessionData };
        if (!res.ok) {
          if (res.status === 404) {
            setError("session_not_found");
          } else if (res.status === 401) {
            setError("authentication_required");
          } else if (res.status === 403) {
            setError("access_denied_to_session");
          } else if (res.status === 400) {
            setError("session_already_completed");
          } else {
            setError(data.error || "Failed to fetch practice session.");
          }
          return;
        }
        if (data.session) {
          setSessionData(data.session);

          // Restore progress from localStorage if available
          const savedIndex = loadProgress(sessionId);
          if (savedIndex !== null && data.session.questions.length > 0) {
            // Clamp to valid range
            const validIndex = Math.min(savedIndex, data.session.questions.length - 1);
            setCurrentQuestionIndex(Math.max(0, validIndex));
          } else {
            // No saved progress, start at beginning
            setCurrentQuestionIndex(0);
          }

          // Track session started event only once per session
          if (!hasStartedEventFired(sessionId)) {
            trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_SESSION_STARTED, {
              sessionId: sessionId,
              exam: data.session.exam || "unknown",
              questionCount: data.session.questions.length || 0,
              userId: user.id || null,
              source: data.session.source,
            });
            markStartedEventFired(sessionId);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred while fetching session.");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
    // Using user?.id instead of user to avoid re-fetches when user object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user?.id, isAuthLoading, posthog]);

  // Save progress to localStorage whenever currentQuestionIndex changes
  useEffect(() => {
    if (sessionId && sessionData) {
      saveProgress(sessionId, currentQuestionIndex);
    }
  }, [sessionId, currentQuestionIndex, sessionData]);

  const currentQuestion = sessionData?.questions[currentQuestionIndex];

  const handleNextQuestion = useCallback(async () => {
    setSelectedOptionLabel(null);
    if (sessionData && currentQuestionIndex < sessionData.questions.length - 1) {
      setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
    } else {
      // All questions answered, complete the session
      setLoading(true);
      try {
        const res = await fetch(`/api/practice/session/${sessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = (await res.json()) as { error?: string; route?: string };
        if (!res.ok) {
          throw new Error(data.error || "Failed to complete session.");
        }

        trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_SESSION_COMPLETED, {
          sessionId: sessionId,
          exam: sessionData?.exam,
          totalQuestions: sessionData?.questions.length || 0,
          userId: user?.id || null,
        });

        if (data.route) {
          router.push(data.route);
        } else {
          router.push(`/practice/session/${sessionId}/summary`);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
  }, [sessionData, currentQuestionIndex, sessionId, posthog, user, router]);

  // Background answer submission with retry logic and error tracking
  const submitAnswerWithRetry = useCallback(
    async (questionId: string, selectedLabel: string, attempt: number = 1) => {
      const maxAttempts = 3;
      const baseDelay = 1000; // 1 second base delay

      try {
        const response = await fetch(`/api/practice/session/${sessionId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            selectedLabel,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Success - remove from error tracking
        setSubmissionErrors((prev) => {
          const newSet = new Set(prev);
          newSet.delete(questionId);
          return newSet;
        });

        // Remove from retry queue if it was there
        setRetryQueue((prev) => prev.filter((item) => item.questionId !== questionId));
      } catch (error) {
        console.error(`Failed to submit answer for question ${questionId} (attempt ${attempt}):`, error);

        // Add to error tracking
        setSubmissionErrors((prev) => new Set(prev).add(questionId));

        if (attempt < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = baseDelay * Math.pow(2, attempt - 1);

          // Add to retry queue
          setRetryQueue((prev) => {
            const filtered = prev.filter((item) => item.questionId !== questionId);
            return [...filtered, { questionId, selectedLabel, attempts: attempt + 1 }];
          });

          // Schedule retry
          setTimeout(() => {
            submitAnswerWithRetry(questionId, selectedLabel, attempt + 1);
          }, delay);
        } else {
          // Max attempts reached - keep in error state for manual retry
          console.error(`Failed to submit answer for question ${questionId} after ${maxAttempts} attempts`);
        }
      }
    },
    [sessionId]
  );

  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion || selectedOptionLabel === null) return;

    // Track the question answered event immediately
    trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_QUESTION_ANSWERED, {
      sessionId: sessionId,
      questionNumber: currentQuestionIndex + 1,
      totalQuestions: sessionData?.questions.length || 0,
      questionId: currentQuestion.id,
      selectedAnswer: selectedOptionLabel,
      exam: sessionData?.exam,
      userId: user?.id || null,
    });

    // Submit answer in background with retry logic
    submitAnswerWithRetry(currentQuestion.id, selectedOptionLabel);

    // Immediately advance to next question
    handleNextQuestion();
  }, [
    currentQuestion,
    selectedOptionLabel,
    sessionId,
    currentQuestionIndex,
    sessionData,
    posthog,
    user,
    handleNextQuestion,
    submitAnswerWithRetry,
  ]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!sessionData) return;

      const currentQuestion = sessionData.questions[currentQuestionIndex];
      if (!currentQuestion) return;

      const options = currentQuestion.options;
      const currentIndex = selectedOptionLabel
        ? options.findIndex((opt) => opt.label === selectedOptionLabel)
        : -1;

      switch (event.key) {
        case "ArrowDown":
        case "j":
          event.preventDefault();
          const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
          setSelectedOptionLabel(options[nextIndex].label);
          break;
        case "ArrowUp":
        case "k":
          event.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
          setSelectedOptionLabel(options[prevIndex].label);
          break;
        case "Enter":
          event.preventDefault();
          if (selectedOptionLabel) {
            handleSubmitAnswer();
          }
          break;
      }
    },
    [sessionData, currentQuestionIndex, selectedOptionLabel, handleSubmitAnswer]
  );

  // Use ref pattern to prevent memory leak from frequent event listener re-registration
  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDownRef.current(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []); // Empty dependency array prevents unnecessary re-registration

  const handleSkip = useCallback(() => {
    // Simply advance to next question without submitting answer
    handleNextQuestion();
  }, [handleNextQuestion]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-600">Loading practice session...</div>
      </div>
    );

  // Error cases
  if (error) {
    // Access denied
    if (error === "access_denied_to_session") {
      return (
        <main className="max-w-2xl mx-auto my-8 p-4 md:p-6 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-semibold mb-4">Access Denied</h1>
          <div className="mb-6">
            <p className="text-red-600 mb-4">
              You do not have permission to access this practice session, or the session identifier is invalid.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </main>
      );
    }

    // Session not found
    if (error === "session_not_found") {
      return (
        <main className="max-w-2xl mx-auto my-8 p-4 md:p-6 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-semibold mb-4">Session Not Found</h1>
          <div className="mb-6">
            <p className="text-red-600 mb-4">
              Your practice session could not be found. This can happen if:
            </p>
            <ul className="text-slate-600 mb-6 space-y-1">
              <li>The session ID is invalid</li>
              <li>The session was deleted</li>
            </ul>
            <p>Please start a new practice session to continue.</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </main>
      );
    }

    // Session already completed
    if (error === "session_already_completed") {
      return (
        <main className="max-w-2xl mx-auto my-8 p-4 md:p-6 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-semibold mb-4">Session Already Completed</h1>
          <div className="mb-6">
            <p className="text-slate-600 mb-4">This practice session has already been completed.</p>
          </div>
          <button
            onClick={() => router.push(`/practice/session/${sessionId}/summary`)}
            className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            View Results
          </button>
        </main>
      );
    }

    // Authentication required
    if (error === "authentication_required") {
      return (
        <main className="max-w-2xl mx-auto my-8 p-4 md:p-6 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-semibold mb-4">Authentication Required</h1>
          <div className="mb-6">
            <p className="text-red-600 mb-4">You need to be logged in to access this practice session.</p>
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
          onClick={() => router.push("/dashboard")}
          className="h-10 px-8 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
        >
          Return to Dashboard
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
          <h1 className="text-lg font-semibold text-slate-900">Practice Session</h1>
          <div className="text-sm font-medium text-slate-600">
            Question {currentQuestionIndex + 1} of {sessionData?.questions.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-indigo-600 transition-all duration-300 ease-out"
            style={{
              width: `${((currentQuestionIndex + 1) / (sessionData?.questions.length || 1)) * 100}%`,
            }}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left rail - Desktop only */}
          <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-20">
            {/* Progress card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
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
                      width: `${(currentQuestionIndex / (sessionData?.questions.length || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Submission status card - only show if there are errors or retries */}
            {(submissionErrors.size > 0 || retryQueue.length > 0) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">Submission Status</h3>
                {submissionErrors.size > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-amber-700">
                      {submissionErrors.size} answer{submissionErrors.size === 1 ? "" : "s"} failed to save
                    </p>
                  </div>
                )}
                {retryQueue.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-amber-700">
                      Retrying {retryQueue.length} submission{retryQueue.length === 1 ? "" : "s"}...
                    </p>
                  </div>
                )}
                <p className="text-xs text-amber-600">
                  Answers will be retried automatically. Continue with the test.
                </p>
              </div>
            )}
          </aside>

          {/* Main column */}
          <div className="col-span-12 lg:col-span-9">
            {/* Question card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-6">
                Practice Question
              </h2>

              {/* Question stem */}
              <div className="max-w-3xl mb-8">
                <div className="text-lg leading-relaxed text-slate-700">{currentQuestion.stem}</div>
              </div>

              {/* Answer options - Radio group */}
              <div role="radiogroup" aria-label="Answer choices" className="space-y-3 mb-8">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedOptionLabel === option.label;
                  const labels = ["A", "B", "C", "D", "E", "F"];

                  return (
                    <label
                      key={option.label}
                      className={`relative flex gap-3 rounded-xl border p-4 cursor-pointer transition shadow-sm ${
                        isSelected
                          ? "border-indigo-600 ring-4 ring-indigo-600/10 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-400"
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
                      <div
                        className={`w-8 h-8 rounded-full grid place-content-center text-sm font-medium flex-shrink-0 ${
                          isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {labels[index] || option.label}
                      </div>

                      {/* Option text */}
                      <div className="flex-1 text-slate-700 leading-relaxed">{option.text}</div>
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
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/30"
            }`}
          >
            {currentQuestionIndex === (sessionData?.questions.length || 0) - 1
              ? "Submit & Finish"
              : "Submit answer"}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PracticeSessionPage;

