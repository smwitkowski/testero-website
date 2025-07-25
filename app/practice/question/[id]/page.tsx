"use client";
import React, { useEffect, useState } from "react";
import { useParams } from 'next/navigation'; // To get ID from URL

interface Option {
  id: string;
  label: string;
  text: string;
}

interface QuestionData {
  id: string;
  question_text: string;
  options: Option[];
  // explanation?: string; // If explanation is part of initial fetch
}

const SpecificPracticeQuestionPage = () => {
  const params = useParams();
  const questionId = params?.id as string;

  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    correctOptionKey: string;
    explanationText: string;
  } | null>(null);
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
          const data = await res.json();
          throw new Error(data.error || `Failed to fetch question ${questionId}`);
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
  }, [questionId]);

  const handleSubmit = async () => {
    if (!question || !selectedOptionKey) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/questions/submit", { // Submit API remains the same
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id, // Use the ID of the fetched question
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

  // The rest of the JSX can be very similar to app/practice/question/page.tsx
  // For brevity, I'm including a simplified version here.
  // In a real scenario, you'd likely refactor the common UI into a shared component.

  if (loading) return <main style={{ padding: 24 }}><div>Loading question...</div></main>;
  if (error) return <main style={{ padding: 24 }}><div style={{ color: "red" }}>Error: {error}</div></main>;
  if (!question) return <main style={{ padding: 24 }}><div>Question not found.</div></main>;

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: 24, border: "1px solid #eee", borderRadius: 8 }}>
      <h1>Practice Question {question.id}</h1>
      <section style={{ margin: "2rem 0" }}>
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 24 }}>
          {question.question_text}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {question.options.map((option) => {
            const isSelected = selectedOptionKey === option.label;
            const isCorrect = feedback?.correctOptionKey === option.label;
            const isIncorrect = feedback && isSelected && !feedback.isCorrect;
            const isDisabled = !!feedback;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => !isDisabled && setSelectedOptionKey(option.label)}
                disabled={isDisabled}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  border: isSelected ? "2px solid #0070f3" : "1px solid #ccc",
                  background: isCorrect
                    ? "#d1fadf"
                    : isIncorrect
                    ? "#ffe0e0"
                    : isSelected
                    ? "#e6f0fd"
                    : "#fafafa",
                  fontWeight: isSelected ? 600 : 400,
                  color: isCorrect
                    ? "#219653"
                    : isIncorrect
                    ? "#d32f2f"
                    : isSelected
                    ? "#0070f3"
                    : "#222",
                  transition: "all 0.15s",
                  opacity: isDisabled && !isSelected && !isCorrect ? 0.7 : 1,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                }}
              >
                {option.text}
                {isCorrect && feedback && (
                  <span style={{ marginLeft: 8, fontWeight: 700 }}>✓</span>
                )}
                {isIncorrect && feedback && (
                  <span style={{ marginLeft: 8, fontWeight: 700 }}>✗</span>
                )}
              </button>
            );
          })}
        </div>
        {!feedback ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedOptionKey || submitting}
            style={{
              padding: "12px 32px",
              borderRadius: 6,
              background: !selectedOptionKey || submitting ? "#ccc" : "#0070f3",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: !selectedOptionKey || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        ) : null}
        {submitError && <div style={{ color: "red", marginTop: 16 }}>{submitError}</div>}
        {feedback && (
          <div style={{ marginTop: 32 }}>
            <div style={{
              color: feedback.isCorrect ? "#219653" : "#d32f2f",
              fontWeight: 600,
              fontSize: 18,
              marginBottom: 12,
            }}>
              {feedback.isCorrect ? "Correct!" : "Incorrect."}
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Explanation:</strong>
              <div>{feedback.explanationText || "No explanation provided."}</div>
            </div>
            {/* For a specific question page, "Next Question" might link to a list or another specific question */}
            {/* Or simply allow re-attempt if that's desired, or go back to a question list page */}
            <button
              onClick={() => {
                // Potentially navigate to a list of questions or a new random one
                // For now, just clear feedback to allow re-submission or a different interaction model
                setFeedback(null);
                setSelectedOptionKey(null);
                setSubmitError(null);
              }}
              style={{
                marginTop: 16,
                padding: "10px 28px",
                borderRadius: 6,
                background: "#f2f2f2",
                color: "#222",
                border: "1px solid #ccc",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try Again or Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default SpecificPracticeQuestionPage;
