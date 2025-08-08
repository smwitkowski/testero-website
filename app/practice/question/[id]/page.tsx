"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation"; // To get ID from URL
import {
  QuestionDisplay,
  QuestionFeedback,
  SubmitButton,
  QuestionData,
  FeedbackType,
} from "@/components/practice";

const SpecificPracticeQuestionPage = () => {
  const params = useParams();
  const questionId = params?.id as string;

  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!questionId) {
      setError("Question ID not found in URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/questions/${questionId}`) // Fetch specific question by ID
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || `Failed to fetch question ${questionId}`);
        }
        return res.json() as Promise<QuestionData>;
      })
      .then((data) => {
        setQuestion(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
        setLoading(false);
      });
  }, [questionId]);

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
      const data = (await res.json()) as { error?: string } & FeedbackType;
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setFeedback(data as FeedbackType);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setSubmitError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // The rest of the JSX can be very similar to app/practice/question/page.tsx
  // For brevity, I'm including a simplified version here.
  // In a real scenario, you'd likely refactor the common UI into a shared component.

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
