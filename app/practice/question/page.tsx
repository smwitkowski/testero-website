"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  QuestionDisplay,
  QuestionFeedback,
  SubmitButton,
  QuestionData,
  FeedbackType,
} from "@/components/practice";
import { usePostHog } from "posthog-js/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getErrorMessage, getApiErrorMessage, trackError } from "@/lib/utils/error-handling";
import { captureWithDeduplication } from "@/lib/utils/analytics-deduplication";

const PracticeQuestionPage = () => {
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  // Track last 3 question IDs as a small anti-race safeguard (server-side tracking is primary)
  const recentQuestionIds = useRef<string[]>([]);
  // Deduplication ref to prevent duplicate fetches
  const lastFetchKeyRef = useRef<string | null>(null);
  const posthog = usePostHog();
  const { user } = useAuth();
  const userId = user?.id;

  // Track page view for authenticated users (middleware ensures auth)
  useEffect(() => {
    if (!userId) return;
    
    captureWithDeduplication(posthog, "practice_page_viewed", {
      user_id: userId,
    });
  }, [userId, posthog]);

  // Initial question fetch effect - keyed on userId to prevent re-fetches when user object identity changes
  useEffect(() => {
    // Wait for user session to load
    if (!userId) return;

    // Build URL with excludeIds if we have recent question IDs
    const url = recentQuestionIds.current.length
      ? `/api/questions/current?excludeIds=${recentQuestionIds.current.join(",")}`
      : "/api/questions/current";
    
    // Deduplication: skip if we've already fetched this exact combination
    const fetchKey = `${userId}:${url}`;
    if (lastFetchKeyRef.current === fetchKey) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;

    setLoading(true);
    setError(null);
    
    // AbortController for cleanup
    const controller = new AbortController();
    
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const errorMessage = await getApiErrorMessage(res);
          throw new Error(errorMessage);
        }
        return res.json() as Promise<QuestionData>;
      })
      .then((data) => {
        // Only update state if request wasn't aborted
        if (controller.signal.aborted) return;
        
        setQuestion(data);
        setQuestionStartTime(new Date());
        setLoading(false);

        // Update recent question IDs: add new ID to front, remove duplicates, keep last 3
        // This is a small anti-race safeguard; server-side tracking in practice_question_attempts_v2
        // is the primary mechanism for preventing repeats
        recentQuestionIds.current = [
          data.id,
          ...recentQuestionIds.current.filter((id) => id !== data.id),
        ].slice(0, 3);
      })
      .catch((error) => {
        // Ignore AbortError - request was cancelled intentionally
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        
        // Only update error state if request wasn't aborted
        if (controller.signal.aborted) return;
        
        const errorMessage = getErrorMessage(error, "Failed to load question");
        setError(errorMessage);
        setLoading(false);

        // Track error
        trackError(posthog, error, "practice_question_error", {
          userId: userId,
          errorType: "load_error",
        });
      });

    // Cleanup: abort in-flight request if effect re-runs or component unmounts
    return () => {
      controller.abort();
    };
  }, [userId, posthog]);

  // Separate effect for analytics tracking - decoupled from fetch to prevent re-fetches
  useEffect(() => {
    if (!question || !userId) return;

    // Track question loaded with UUID property for reliable analytics
    captureWithDeduplication(posthog, "practice_question_loaded", {
      user_id: userId,
      question_id: question.id, // Keep for backward compatibility
      question_uuid: question.id, // String-typed UUID for reliable analysis
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, userId, posthog]);

  const fetchNewQuestion = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setSelectedOptionKey(null);
    setSubmitError(null);

    try {
      // Build URL with excludeIds if we have recent question IDs
      const url = recentQuestionIds.current.length
        ? `/api/questions/current?excludeIds=${recentQuestionIds.current.join(",")}`
        : "/api/questions/current";
      
      const res = await fetch(url);
      if (!res.ok) {
        const errorMessage = await getApiErrorMessage(res);
        throw new Error(errorMessage);
      }
      const data = (await res.json()) as QuestionData;
      setQuestion(data);
      setQuestionStartTime(new Date());

      // Update recent question IDs: add new ID to front, remove duplicates, keep last 3
      // This is a small anti-race safeguard; server-side tracking in practice_question_attempts_v2
      // is the primary mechanism for preventing repeats
      recentQuestionIds.current = [
        data.id,
        ...recentQuestionIds.current.filter((id) => id !== data.id),
      ].slice(0, 3);

      // Track new question loaded with UUID property for reliable analytics
      // Note: The separate analytics effect will also fire, but this adds is_next_question context
      captureWithDeduplication(posthog, "practice_question_loaded", {
        user_id: userId,
        question_id: data.id, // Keep for backward compatibility
        question_uuid: data.id, // String-typed UUID for reliable analysis
        is_next_question: true,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to load next question");
      setError(errorMessage);

      // Track error
      trackError(posthog, error, "practice_question_error", {
        userId: userId,
        errorType: "load_error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!question || !selectedOptionKey) return;
    setSubmitting(true);
    setSubmitError(null);

    // Calculate time spent on question
    const timeSpent = questionStartTime
      ? Math.round((new Date().getTime() - questionStartTime.getTime()) / 1000)
      : null;

    try {
      const res = await fetch("/api/questions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          selectedOptionKey,
        }),
      });
      if (!res.ok) {
        const errorMessage = await getApiErrorMessage(res);
        throw new Error(errorMessage);
      }
      
      const data = (await res.json()) as FeedbackType;
      setFeedback(data);

      // Track question answered (force track for critical business metric)
      captureWithDeduplication(posthog, "practice_question_answered", {
        user_id: userId,
        question_id: question.id, // Keep for backward compatibility
        question_uuid: question.id, // String-typed UUID for reliable analysis
        is_correct: data.isCorrect,
        time_spent_seconds: timeSpent,
        selected_option: selectedOptionKey,
      }, { forceTrack: true });
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to submit answer");
      setSubmitError(errorMessage);

      // Track submission error
      trackError(posthog, error, "practice_question_error", {
        userId: userId,
        errorType: "submit_error",
        context: { question_id: question?.id },
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading while user session loads (middleware already ensured auth)
  if (!user) {
    return (
      <main className="p-6">
        <div className="text-center">Loading...</div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto my-8 p-6 border border-gray-200 rounded-lg">
      <h1 className="text-2xl font-bold mb-6">Practice Question</h1>
      <section className="my-8">
        {loading && <div className="text-center">Loading question...</div>}
        {error && <div className="text-red-600 text-center">Error: {error}</div>}
        {!loading && !error && question && (
          <>
            <QuestionDisplay
              question={question}
              selectedOptionKey={selectedOptionKey}
              feedback={feedback}
              onOptionSelect={setSelectedOptionKey}
            />
            {!feedback ? (
              <SubmitButton
                onSubmit={handleSubmit}
                disabled={!selectedOptionKey || submitting}
                submitting={submitting}
              />
            ) : null}
            {submitError && <div className="text-red-600 mt-4">{submitError}</div>}
            {feedback && (
              <QuestionFeedback
                feedback={feedback}
                onNextAction={fetchNewQuestion}
                nextActionLabel="Next Question"
              />
            )}
          </>
        )}
      </section>
    </main>
  );
};

export default PracticeQuestionPage;
