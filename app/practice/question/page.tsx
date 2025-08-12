"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  QuestionDisplay,
  QuestionFeedback,
  SubmitButton,
  QuestionData,
  FeedbackType,
} from "@/components/practice";
import { usePostHog } from "posthog-js/react";
import { useAuth } from "@/components/providers/AuthProvider";

const PracticeQuestionPage = () => {
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  const posthog = usePostHog();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Check authentication and redirect if needed
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Track blocked access
      posthog?.capture("practice_access_blocked", {
        source: "practice_question_page",
        timestamp: new Date().toISOString(),
      });

      // Redirect to login with return URL
      const returnUrl = `/practice/question`;
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // Track page view for authenticated users
    posthog?.capture("practice_page_viewed", {
      user_id: user.id,
    });
  }, [user, authLoading, router, posthog]);

  useEffect(() => {
    // Don't fetch questions until auth is confirmed
    if (authLoading || !user) return;

    setLoading(true);
    setError(null);
    fetch("/api/questions/current")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || "Failed to fetch question");
        }
        return res.json() as Promise<QuestionData>;
      })
      .then((data) => {
        setQuestion(data);
        setQuestionStartTime(new Date());
        setLoading(false);

        // Track question loaded
        posthog?.capture("practice_question_loaded", {
          user_id: user?.id,
          question_id: data.id,
        });
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
        setLoading(false);

        // Track error
        posthog?.capture("practice_question_error", {
          user_id: user?.id,
          error: err.message || "Unknown error",
          error_type: "load_error",
        });
      });
  }, [user, posthog, authLoading]);

  const fetchNewQuestion = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setSelectedOptionKey(null);
    setSubmitError(null);

    try {
      const res = await fetch("/api/questions/current");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to fetch question");
      }
      const data = (await res.json()) as QuestionData;
      setQuestion(data);
      setQuestionStartTime(new Date());

      // Track new question loaded
      posthog?.capture("practice_question_loaded", {
        user_id: user?.id,
        question_id: data.id,
        is_next_question: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");

      // Track error
      posthog?.capture("practice_question_error", {
        user_id: user?.id,
        error: err instanceof Error ? err.message : "Unknown error",
        error_type: "load_error",
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
      const data = (await res.json()) as { error?: string } & FeedbackType;
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setFeedback(data as FeedbackType);

      // Track question answered
      posthog?.capture("practice_question_answered", {
        user_id: user?.id,
        question_id: question.id,
        is_correct: data.isCorrect,
        time_spent_seconds: timeSpent,
        selected_option: selectedOptionKey,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setSubmitError(errorMessage);

      // Track submission error
      posthog?.capture("practice_question_error", {
        user_id: user?.id,
        question_id: question?.id,
        error: errorMessage,
        error_type: "submit_error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading while auth is being checked
  if (authLoading || !user) {
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
