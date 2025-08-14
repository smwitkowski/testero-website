"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  QuestionDisplay,
  QuestionFeedback,
  SubmitButton,
  QuestionData,
  FeedbackType,
} from "@/components/practice";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import { getErrorMessage, getApiErrorMessage, trackError } from "@/lib/utils/error-handling";
import { captureWithDeduplication } from "@/lib/utils/analytics-deduplication";

const SpecificPracticeQuestionPage = () => {
  const params = useParams();
  const questionId = params?.id as string;
  const { user } = useAuth();
  const posthog = usePostHog();

  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Track page view for authenticated users (middleware ensures auth)
  useEffect(() => {
    if (!user) return;
    
    captureWithDeduplication(posthog, "practice_page_viewed", {
      user_id: user.id,
      question_id: questionId,
    });
  }, [user, questionId, posthog]);

  useEffect(() => {
    // Fetch specific question (middleware ensures user is authenticated)

    if (!questionId) {
      setError("Question ID not found in URL.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/questions/${questionId}`, { signal: controller.signal });
        if (!res.ok) {
          const errorMessage = await getApiErrorMessage(res);
          throw new Error(errorMessage);
        }
        const data = (await res.json()) as QuestionData;
        setQuestion(data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const errorMessage = getErrorMessage(err, `Failed to load question ${questionId}`);
        setError(errorMessage);

        // Track error
        trackError(posthog, err, "practice_question_error", {
          userId: user?.id,
          errorType: "load_error",
          context: { question_id: questionId },
        });
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [questionId, user?.id, posthog]);

  const handleSubmit = async () => {
    if (!question || !selectedOptionKey) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/questions/submit", {
        // Submit API remains the same
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id, // Use the ID of the fetched question
          selectedOptionKey,
        }),
      });
      if (!res.ok) {
        const errorMessage = await getApiErrorMessage(res);
        throw new Error(errorMessage);
      }
      
      const data = (await res.json()) as FeedbackType;
      setFeedback(data);
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

  // Show loading while user session loads (middleware already ensured auth)
  if (!user) {
    return (
      <main className="p-6">
        <div className="text-center">Loading...</div>
      </main>
    );
  }

  if (loading)
    return (
      <main className="p-6">
        <div className="text-center">Loading question...</div>
      </main>
    );
  if (error)
    return (
      <main className="p-6">
        <div className="text-red-600 text-center">Error: {error}</div>
      </main>
    );
  if (!question)
    return (
      <main className="p-6">
        <div className="text-center">Question not found.</div>
      </main>
    );

  return (
    <main className="max-w-3xl mx-auto my-8 p-6 border border-gray-200 rounded-lg">
      <h1 className="text-2xl font-bold mb-6">Practice Question {question.id}</h1>
      <section className="my-8">
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
            onNextAction={() => {
              // Clear feedback to allow re-attempt
              setFeedback(null);
              setSelectedOptionKey(null);
              setSubmitError(null);
            }}
            nextActionLabel="Try Again"
          />
        )}
      </section>
    </main>
  );
};

export default SpecificPracticeQuestionPage;
