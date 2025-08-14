"use client";
import React, { useEffect, useState } from "react";
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
  const [authTimeout, setAuthTimeout] = useState(false);
  const posthog = usePostHog();
  const { user, isLoading: authLoading } = useAuth();

  // Add auth timeout to prevent infinite loading
  useEffect(() => {
    if (authLoading) {
      const timeout = setTimeout(() => {
        setAuthTimeout(true);
      }, 10000); // 10 second timeout
      
      return () => clearTimeout(timeout);
    }
  }, [authLoading]);

  // Track page view for authenticated users (middleware ensures auth)
  useEffect(() => {
    if (!user || authLoading) return;
    
    captureWithDeduplication(posthog, "practice_page_viewed", {
      user_id: user.id,
    });
  }, [user, authLoading, posthog]);

  useEffect(() => {
    // Fetch questions (middleware ensures user is authenticated)

    setLoading(true);
    setError(null);
    fetch("/api/questions/current")
      .then(async (res) => {
        if (!res.ok) {
          const errorMessage = await getApiErrorMessage(res);
          throw new Error(errorMessage);
        }
        return res.json() as Promise<QuestionData>;
      })
      .then((data) => {
        setQuestion(data);
        setQuestionStartTime(new Date());
        setLoading(false);

        // Track question loaded
        captureWithDeduplication(posthog, "practice_question_loaded", {
          user_id: user?.id,
          question_id: data.id,
        });
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error, "Failed to load question");
        setError(errorMessage);
        setLoading(false);

        // Track error
        trackError(posthog, error, "practice_question_error", {
          userId: user?.id,
          errorType: "load_error",
        });
      });
  }, [user, posthog]);

  const fetchNewQuestion = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setSelectedOptionKey(null);
    setSubmitError(null);

    try {
      const res = await fetch("/api/questions/current");
      if (!res.ok) {
        const errorMessage = await getApiErrorMessage(res);
        throw new Error(errorMessage);
      }
      const data = (await res.json()) as QuestionData;
      setQuestion(data);
      setQuestionStartTime(new Date());

      // Track new question loaded
      captureWithDeduplication(posthog, "practice_question_loaded", {
        user_id: user?.id,
        question_id: data.id,
        is_next_question: true,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to load next question");
      setError(errorMessage);

      // Track error
      trackError(posthog, error, "practice_question_error", {
        userId: user?.id,
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
        user_id: user?.id,
        question_id: question.id,
        is_correct: data.isCorrect,
        time_spent_seconds: timeSpent,
        selected_option: selectedOptionKey,
      }, { forceTrack: true });
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to submit answer");
      setSubmitError(errorMessage);

      // Track submission error
      trackError(posthog, error, "practice_question_error", {
        userId: user?.id,
        errorType: "submit_error",
        context: { question_id: question?.id },
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading while auth is being resolved (should be brief since middleware ensures auth)
  if (authLoading && !authTimeout) {
    return (
      <main className="p-6">
        <div className="text-center">Loading...</div>
      </main>
    );
  }

  // Show error if auth takes too long to resolve
  if (authTimeout) {
    return (
      <main className="p-6">
        <div className="text-center text-red-600">
          Authentication timeout. Please refresh the page or try again.
        </div>
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
