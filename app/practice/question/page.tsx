"use client";
import React, { useEffect, useState } from "react";

interface Option {
  id: string;
  label: string;
  text: string;
}

interface QuestionData {
  id: string;
  question_text: string;
  options: Option[];
}

const PracticeQuestionPage = () => {
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
    setLoading(true);
    setError(null);
    fetch("/api/question/current")
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
      const res = await fetch("/api/question/current");
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
      const res = await fetch("/api/question/submit", {
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
            <div className="text-xl font-medium mb-6">
              {question.question_text}
            </div>
            <div className="flex flex-col gap-3 mb-8 max-w-[90%] mx-auto">
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
                    className={`
                      p-3 rounded-md text-left transition-all duration-150 w-full
                      ${isSelected ? 'border-2 border-blue-500' : 'border border-gray-300'}
                      ${isCorrect 
                        ? 'bg-green-100 text-green-700 border-green-500' 
                        : isIncorrect 
                        ? 'bg-red-100 text-red-700 border-red-500'
                        : isSelected 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                      }
                      ${isSelected ? 'font-semibold' : 'font-normal'}
                      ${isDisabled && !isSelected && !isCorrect ? 'opacity-70' : 'opacity-100'}
                      ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {option.text}
                    {isCorrect && feedback && (
                      <span className="ml-2 font-bold">✓</span>
                    )}
                    {isIncorrect && feedback && (
                      <span className="ml-2 font-bold">✗</span>
                    )}
                  </button>
                );
              })}
            </div>
            {!feedback ? (
              <button
                onClick={handleSubmit}
                disabled={!selectedOptionKey || submitting}
                className={`
                  px-8 py-3 rounded-md font-semibold text-white transition-colors
                  ${!selectedOptionKey || submitting 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  }
                `}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            ) : null}
            {submitError && <div className="text-red-600 mt-4">{submitError}</div>}
            {feedback && (
              <div className="mt-8">
                <div className={`
                  text-lg font-semibold mb-3
                  ${feedback.isCorrect ? 'text-green-600' : 'text-red-600'}
                `}>
                  {feedback.isCorrect ? "Correct!" : "Incorrect."}
                </div>
                <div className="mb-3">
                  <strong className="font-semibold">Explanation:</strong>
                  <div className="mt-1">{feedback.explanationText || "No explanation provided."}</div>
                </div>
                <button
                  onClick={fetchNewQuestion}
                  className="mt-4 px-7 py-2.5 rounded-md bg-gray-100 text-gray-800 border border-gray-300 font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Next Question
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
};

export default PracticeQuestionPage; 