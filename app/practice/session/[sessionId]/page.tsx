"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { usePracticeTestState } from "@/hooks/usePracticeTestState";
import { getPmleDomainConfig } from "@/lib/constants/pmle-blueprint";
import {
  QuestionNavigator,
  QuestionCard,
  TestHeader,
  TestFooter,
  ExitTestModal,
} from "@/components/practice-test";

interface Option {
  label: string;
  text: string;
}

interface QuestionData {
  id: string;
  stem: string;
  options: Option[];
  domain_code?: string | null;
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

const PracticeSessionPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const posthog = usePostHog();
  const sessionId = params?.sessionId as string;

  const [sessionData, setSessionData] = useState<PracticeSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize test state hook
  const {
    answers,
    flagged,
    currentIndex,
    stats,
    setAnswer,
    toggleFlag,
    setCurrentIndex,
    clearFlags,
  } = usePracticeTestState({
    sessionId: sessionId || "",
    totalQuestions: sessionData?.questions.length || 0,
    questionIds: sessionData?.questions.map((q) => q.id) || [],
  });

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
        }

        trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_SESSION_STARTED, {
          sessionId: sessionId,
          exam: data.session?.exam || "unknown",
          questionCount: data.session?.questions?.length || 0,
          userId: user?.id || null,
          source: data.session?.source,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred while fetching session.");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, user, isAuthLoading, posthog]);

  const currentQuestion = sessionData?.questions[currentIndex];

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, setCurrentIndex]);

  const handleNext = useCallback(() => {
    if (sessionData && currentIndex < sessionData.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [sessionData, currentIndex, setCurrentIndex]);

  const handleSubmitTest = useCallback(async () => {
    if (!sessionData || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Submit all answers in bulk
      const res = await fetch(`/api/practice/session/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.fromEntries(
            Object.entries(answers).filter(([_, value]) => value !== null)
          ),
        }),
      });

      const data = (await res.json()) as { error?: string; route?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to complete session.");
      }

      // Clear flags from storage
      clearFlags();

      trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_SESSION_COMPLETED, {
        sessionId: sessionId,
        exam: sessionData.exam,
        totalQuestions: sessionData.questions.length,
        userId: user?.id || null,
      });

      if (data.route) {
        router.push(data.route);
      } else {
        router.push(`/practice/session/${sessionId}/summary`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
  }, [sessionData, sessionId, answers, isSubmitting, posthog, user, router, clearFlags]);

  const handleExit = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!sessionData || !currentQuestion) return;

      const options = currentQuestion.options;
      const currentAnswer = answers[currentQuestion.id];
      const currentOptionIndex = currentAnswer
        ? options.findIndex((opt) => opt.label === currentAnswer)
        : -1;

      switch (event.key) {
        case "ArrowDown":
        case "j":
          event.preventDefault();
          const nextIndex = currentOptionIndex < options.length - 1 ? currentOptionIndex + 1 : 0;
          setAnswer(currentQuestion.id, options[nextIndex].label);
          break;
        case "ArrowUp":
        case "k":
          event.preventDefault();
          const prevIndex = currentOptionIndex > 0 ? currentOptionIndex - 1 : options.length - 1;
          setAnswer(currentQuestion.id, options[prevIndex].label);
          break;
        case "ArrowLeft":
          event.preventDefault();
          handlePrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          if (currentIndex === (sessionData.questions.length || 0) - 1) {
            handleSubmitTest();
          } else {
            handleNext();
          }
          break;
        case "Escape":
          event.preventDefault();
          setShowExitModal(true);
          break;
      }
    },
    [sessionData, currentQuestion, answers, currentIndex, setAnswer, handlePrevious, handleNext, handleSubmitTest]
  );

  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDownRef.current(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Get domain name for display
  const getDomainName = (domainCode: string | null | undefined): string => {
    if (!domainCode) return "Unknown Domain";
    const config = getPmleDomainConfig(domainCode);
    return config?.displayName || domainCode;
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-600">Loading practice session...</div>
      </div>
    );

  // Error cases (keep existing error handling)
  if (error) {
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

  if (!currentQuestion || !sessionData)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-600">No questions found for this session.</div>
      </div>
    );

  const domainName = getDomainName(currentQuestion.domain_code);
  const answeredQuestionIds = new Set(
    Object.entries(answers)
      .filter(([_, value]) => value !== null)
      .map(([questionId]) => questionId)
  );

  return (
    <div className="min-h-screen bg-white">
      <TestHeader
        examName="Google PMLE"
        testType="Practice Test"
        progressPercent={stats.progressPercent}
        onExit={() => setShowExitModal(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Progress & Navigator */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="sticky top-20">
              <QuestionNavigator
                totalQuestions={sessionData.questions.length}
                currentIndex={currentIndex}
                answeredQuestionIds={answeredQuestionIds}
                flaggedQuestionIds={flagged}
                questionIds={sessionData.questions.map((q) => q.id)}
                onQuestionClick={setCurrentIndex}
              />
            </div>
          </aside>

          {/* Center Column - Question Content */}
          <div className="col-span-12 lg:col-span-6">
            <QuestionCard
              questionNumber={currentIndex + 1}
              totalQuestions={sessionData.questions.length}
              domainName={domainName}
              scenario={currentQuestion.stem}
              questionStem=""
              options={currentQuestion.options}
              selectedOptionLabel={answers[currentQuestion.id] || null}
              onOptionSelect={(label) => setAnswer(currentQuestion.id, label)}
            />
          </div>

          {/* Right Column - Question Actions */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="sticky top-20 space-y-4">
              <button
                onClick={() => toggleFlag(currentQuestion.id)}
                className={`w-full rounded-lg border p-3 text-sm font-medium transition-colors ${
                  flagged.has(currentQuestion.id)
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {flagged.has(currentQuestion.id) ? "Flagged" : "Flag for review"}
              </button>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-600">Domain</div>
                <div className="mt-1 text-sm text-slate-900">{domainName}</div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <TestFooter
        questionNumber={currentIndex + 1}
        totalQuestions={sessionData.questions.length}
        answeredCount={stats.answeredCount}
        unansweredCount={stats.unansweredCount}
        flaggedCount={stats.flaggedCount}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSubmit={handleSubmitTest}
        isFirstQuestion={currentIndex === 0}
        isLastQuestion={currentIndex === sessionData.questions.length - 1}
      />

      <ExitTestModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        onConfirm={handleExit}
      />
    </div>
  );
};

export default PracticeSessionPage;
