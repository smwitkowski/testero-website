"use client";
import React, { useEffect, useState } from "react";
import { 
  QuestionDisplay, 
  QuestionFeedback, 
  SubmitButton, 
  QuestionData, 
  FeedbackType 
} from "@/components/practice";

const PracticeQuestionPage = () => {
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/questions/current")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch question");
        }
        return res.json();
      })
      .then((data) => {
        setQuestion(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
        setLoading(false);
      });
  }, []);

  const fetchNewQuestion = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    setSelectedOptionKey(null);
    setSubmitError(null);
    
    try {
      const res = await fetch("/api/questions/current");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch question");
      }
      const data = await res.json();
      setQuestion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!question || !selectedOptionKey) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/questions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          selectedOptionKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setFeedback(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setSubmitError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

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