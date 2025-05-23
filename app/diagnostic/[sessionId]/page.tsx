"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Option {
  label: string;
  text: string;
}

interface QuestionData {
  stem: string;
  options: Option[];
}

interface DiagnosticResults {
  sessionId: string;
  examType: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  topicRecommendations: string[];
}

const DiagnosticSessionPage = () => {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    correctOptionLabel: string;
    explanationText: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<DiagnosticResults | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Session ID not found in URL.");
      setLoading(false);
      return;
    }

    // Fetch questions from local storage if available (from /api/diagnostic/start response)
    const storedQuestions = localStorage.getItem(`diagnostic_questions_${sessionId}`);
    if (storedQuestions) {
      setQuestions(JSON.parse(storedQuestions));
      setLoading(false);
    } else {
      // If not in local storage, it means the user navigated directly or refreshed.
      // In a real app, you'd fetch the session details and questions from the backend.
      // For this MVP, we'll just show an error or redirect.
      setError("Diagnostic session not found or expired. Please start a new diagnostic.");
      setLoading(false);
    }
  }, [sessionId]);

  const currentQuestion = questions[currentQuestionIndex];

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || selectedOptionLabel === null) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/diagnostic/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: `placeholder-id-${currentQuestionIndex}`, // Placeholder ID for now
          selectedLabel: selectedOptionLabel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit answer.');
      }
      setFeedback(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    setFeedback(null);
    setSelectedOptionLabel(null);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    } else {
      // All questions answered, fetch results
      setLoading(true);
      try {
        const res = await fetch(`/api/diagnostic/results?sessionId=${sessionId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch results.');
        }
        setResults(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) return <main style={{ padding: 24 }}><div>Loading diagnostic...</div></main>;
  if (error) return <main style={{ padding: 24 }}><div style={{ color: "red" }}>Error: {error}</div></main>;

  if (results) {
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
        <h1>Diagnostic Results</h1>
        <p>Exam Type: {results.examType}</p>
        <p>Total Questions: {results.totalQuestions}</p>
        <p>Correct Answers: {results.correctAnswers}</p>
        <p>Score: {results.score}%</p>
        <h2>Topic Recommendations:</h2>
        <ul>
          {results.topicRecommendations.map((rec, index) => (
            <li key={index}>{rec}</li>
          ))}
        </ul>
        <button
          onClick={() => router.push('/diagnostic')}
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
          Start New Diagnostic
        </button>
      </main>
    );
  }

  if (!currentQuestion) return <main style={{ padding: 24 }}><div>No questions found for this session.</div></main>;

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h1>Diagnostic Question {currentQuestionIndex + 1} of {questions.length}</h1>
      <section style={{ margin: '2rem 0' }}>
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 24 }}>
          {currentQuestion.stem}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOptionLabel === option.label;
            const isCorrectOption = feedback?.correctOptionLabel === option.label;
            const isIncorrectSelected = feedback && isSelected && !feedback.isCorrect;
            const isDisabled = !!feedback;

            return (
              <button
                key={option.label}
                type="button"
                onClick={() => !isDisabled && setSelectedOptionLabel(option.label)}
                disabled={isDisabled}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  border: isSelected ? '2px solid #0070f3' : '1px solid #ccc',
                  background: isCorrectOption
                    ? '#d1fadf'
                    : isIncorrectSelected
                    ? '#ffe0e0'
                    : isSelected
                    ? '#e6f0fd'
                    : '#fafafa',
                  fontWeight: isSelected ? 600 : 400,
                  color: isCorrectOption
                    ? '#219653'
                    : isIncorrectSelected
                    ? '#d32f2f'
                    : isSelected
                    ? '#0070f3'
                    : '#222',
                  transition: 'all 0.15s',
                  opacity: isDisabled && !isSelected && !isCorrectOption ? 0.7 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {option.text}
                {isCorrectOption && feedback && (
                  <span style={{ marginLeft: 8, fontWeight: 700 }}>✓</span>
                )}
                {isIncorrectSelected && feedback && (
                  <span style={{ marginLeft: 8, fontWeight: 700 }}>✗</span>
                )}
              </button>
            );
          })}
        </div>
        {!feedback ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedOptionLabel === null || submitting}
            style={{
              padding: '12px 32px',
              borderRadius: 6,
              background: selectedOptionLabel === null || submitting ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: selectedOptionLabel === null || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        ) : (
          <>
            <div style={{ marginTop: 32 }}>
              <div style={{
                color: feedback.isCorrect ? '#219653' : '#d32f2f',
                fontWeight: 600,
                fontSize: 18,
                marginBottom: 12,
              }}>
                {feedback.isCorrect ? 'Correct!' : 'Incorrect.'}
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>Explanation:</strong>
                <div>{feedback.explanationText || 'No explanation provided.'}</div>
              </div>
            </div>
            <button
              onClick={handleNextQuestion}
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
              {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
            </button>
          </>
        )}
      </section>
    </main>
  );
};

export default DiagnosticSessionPage;
