"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Option {
  label: string;
  text: string;
}

interface QuestionData {
  id: number;
  stem: string;
  options: Option[];
}

interface DiagnosticSessionData {
  id: string;
  userId: string;
  examType: string;
  questions: QuestionData[];
  answers: Record<number, string>;
  startedAt: string;
  currentQuestion: number;
}

interface DiagnosticResults {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  recommendations: string[];
  examType: string;
}

const DiagnosticSessionPage = () => {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  const [sessionData, setSessionData] = useState<DiagnosticSessionData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<DiagnosticResults | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        setError("Session ID not found in URL.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/diagnostic?sessionId=${sessionId}`);
        const data = await res.json();
        if (!res.ok) {
          // Handle specific error types
          if (res.status === 404) {
            setError('session_not_found');
          } else if (res.status === 410) {
            setError('session_expired');
          } else if (res.status === 401) {
            setError('authentication_required');
          } else if (res.status === 429) {
            setError('too_many_sessions');
          } else {
            setError(data.error || 'Failed to fetch diagnostic session.');
          }
          return;
        }
        setSessionData(data.session);
        setCurrentQuestionIndex(Object.keys(data.session.answers).length); // Resume from last answered question
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching session.');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const currentQuestion = sessionData?.questions[currentQuestionIndex];

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || selectedOptionLabel === null) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          sessionId,
          data: {
            questionId: currentQuestion.id,
            selectedLabel: selectedOptionLabel,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit answer.');
      }
      setFeedback(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    setFeedback(null);
    setSelectedOptionLabel(null);
    if (sessionData && currentQuestionIndex < sessionData.questions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    } else {
      // All questions answered, fetch results
      setLoading(true);
      try {
        const res = await fetch('/api/diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            sessionId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch results.');
        }
        setResults(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) return <main style={{ padding: 24 }}><div>Loading diagnostic...</div></main>;
  
  if (error) {
    if (error === 'session_not_found') {
      return (
        <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
          <h1>Session Not Found</h1>
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#d32f2f', marginBottom: 16 }}>
              Your diagnostic session has expired or could not be found. This can happen if:
            </p>
            <ul style={{ color: '#666', marginBottom: 24 }}>
              <li>The session expired due to inactivity</li>
              <li>The server was restarted during development</li>
              <li>The session ID is invalid</li>
            </ul>
            <p>Please start a new diagnostic test to continue.</p>
          </div>
          <button
            onClick={() => router.push('/diagnostic')}
            style={{
              padding: '12px 32px',
              borderRadius: 6,
              background: '#0070f3',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start New Diagnostic
          </button>
        </main>
      );
    }

    if (error === 'session_expired') {
      return (
        <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
          <h1>Session Expired</h1>
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#d32f2f', marginBottom: 16 }}>
              Your diagnostic session has expired after 30 minutes of inactivity for security reasons.
            </p>
            <p>Please start a new diagnostic test to continue.</p>
          </div>
          <button
            onClick={() => router.push('/diagnostic')}
            style={{
              padding: '12px 32px',
              borderRadius: 6,
              background: '#0070f3',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start New Diagnostic
          </button>
        </main>
      );
    }

    if (error === 'too_many_sessions') {
      return (
        <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
          <h1>Too Many Active Sessions</h1>
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#d32f2f', marginBottom: 16 }}>
              You have reached the maximum number of active diagnostic sessions (3).
            </p>
            <p>Please complete your existing tests before starting a new one, or wait for them to expire.</p>
          </div>
          <button
            onClick={() => router.push('/diagnostic')}
            style={{
              padding: '12px 32px',
              borderRadius: 6,
              background: '#0070f3',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Diagnostic
          </button>
        </main>
      );
    }

    if (error === 'authentication_required') {
      return (
        <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
          <h1>Authentication Required</h1>
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#d32f2f', marginBottom: 16 }}>
              You need to be logged in to access this diagnostic session.
            </p>
          </div>
          <button
            onClick={() => router.push('/login')}
            style={{
              padding: '12px 32px',
              borderRadius: 6,
              background: '#0070f3',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Login
          </button>
        </main>
      );
    }

    // Generic error fallback
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
        <h1>Error</h1>
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: '#d32f2f', marginBottom: 16 }}>
            Error: {error}
          </p>
        </div>
        <button
          onClick={() => router.push('/diagnostic')}
          style={{
            padding: '12px 32px',
            borderRadius: 6,
            background: '#0070f3',
            color: 'white',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Start New Diagnostic
        </button>
      </main>
    );
  }

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
          {results.recommendations.map((rec: string, index: number) => (
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
      <h1>Diagnostic Question {currentQuestionIndex + 1} of {sessionData?.questions.length}</h1>
      <section style={{ margin: '2rem 0' }}>
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 24 }}>
          {currentQuestion.stem}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOptionLabel === option.label;
            const isCorrectOption = feedback?.correctAnswer === option.label;
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
                <div>{feedback.explanation || 'No explanation provided.'}</div>
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
              {currentQuestionIndex < (sessionData?.questions.length || 0) - 1 ? 'Next Question' : 'View Results'}
            </button>
          </>
        )}
      </section>
    </main>
  );
};

export default DiagnosticSessionPage;
