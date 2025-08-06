"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider"; // Import useAuth
import { usePostHog } from "posthog-js/react";

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

const DiagnosticSessionPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth(); // Get user and auth loading state
  const posthog = usePostHog();
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

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        setError("Session ID not found in URL.");
        setLoading(false);
        return;
      }
      if (isAuthLoading) {
        // Don't fetch if auth state is still loading
        setLoading(true); // Or a different loading state like "Verifying user..."
        return;
      }

      setLoading(true); // Set loading true before fetch
      setError(null);

      let apiUrl = `/api/diagnostic?sessionId=${sessionId}`;
      if (!user) {
        // If no logged-in user, try to append anonymousSessionId
        const storedAnonId = localStorage.getItem("anonymousSessionId");
        if (storedAnonId) {
          apiUrl += `&anonymousSessionId=${storedAnonId}`;
        }
      }

      try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 404) {
            setError("session_not_found");
          } else if (res.status === 410) {
            setError("session_expired");
          } else if (res.status === 401) {
            // Authentication required (e.g. token expired for logged-in user)
            setError("authentication_required");
          } else if (res.status === 403) {
            // Forbidden (e.g. wrong user or bad anonymous ID)
            setError("access_denied_to_session");
          }
          // Removed 429 as session limits are removed for now
          else {
            setError(data.error || "Failed to fetch diagnostic session.");
          }
          return;
        }
        setSessionData(data.session);

        // Track diagnostic session loaded
        posthog?.capture("diagnostic_session_loaded", {
          sessionId: sessionId,
          examType: data.session.examType,
          questionCount: data.session.questions?.length || 0,
          userId: user?.id || null,
          isAnonymous: !user,
        });

        // Resuming logic: API should ideally provide currentQuestionIndex or completed answers
        // For now, if data.session.answers exists and is an object, we can derive it.
        // The API currently doesn't send back answers in the GET session response for simplicity.
        // Client-side might need to track progress or API needs to provide it.
        // Let's assume currentQuestionIndex is managed by API or starts at 0 for now.
        // If API sends back answers or currentQuestion, use that.
        // setCurrentQuestionIndex(data.session.currentQuestion || Object.keys(data.session.answers || {}).length);
        setCurrentQuestionIndex(0); // Start at 0, API will handle actual progress if resumed.
        // Or, if API sends `resumed: true` and `currentQuestion` index, use that.
        // The current GET /api/diagnostic returns currentQuestion: 0
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred while fetching session.");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, user, isAuthLoading, posthog]); // Add user and isAuthLoading to dependency array

  const currentQuestion = sessionData?.questions[currentQuestionIndex];

  // ... (rest of the error handling for specific error codes)
  // Add a case for 'access_denied_to_session'
  if (error === "access_denied_to_session") {
    return (
      <main
        style={{
          maxWidth: 600,
          margin: "2rem auto",
          padding: 24,
          border: "1px solid #eee",
          borderRadius: 8,
        }}
      >
        <h1>Access Denied</h1>
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "#d32f2f", marginBottom: 16 }}>
            You do not have permission to access this diagnostic session, or the session identifier
            is invalid.
          </p>
        </div>
        <button
          onClick={() => router.push("/diagnostic")}
          style={{
            padding: "12px 32px",
            borderRadius: 6,
            background: "#0070f3",
            color: "white",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Start New Diagnostic
        </button>
      </main>
    );
  }

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || selectedOptionLabel === null) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          sessionId,
          data: {
            questionId: currentQuestion.id,
            selectedLabel: selectedOptionLabel,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit answer.");
      }
      setFeedback(data);

      // Track question answered
      posthog?.capture("diagnostic_question_answered", {
        sessionId: sessionId,
        questionNumber: currentQuestionIndex + 1,
        totalQuestions: sessionData?.questions.length || 0,
        questionId: currentQuestion.id,
        selectedAnswer: selectedOptionLabel,
        isCorrect: data.isCorrect,
        examType: sessionData?.examType,
        userId: user?.id || null,
        isAnonymous: !user,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    setFeedback(null);
    setSelectedOptionLabel(null);
    if (sessionData && currentQuestionIndex < sessionData.questions.length - 1) {
      setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
    } else {
      // All questions answered, fetch results
      setLoading(true);
      try {
        const res = await fetch("/api/diagnostic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            sessionId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch results.");
        }

        // Track diagnostic completion
        posthog?.capture("diagnostic_completed", {
          sessionId: sessionId,
          examType: sessionData?.examType,
          totalQuestions: sessionData?.questions.length || 0,
          userId: user?.id || null,
          isAnonymous: !user,
        });

        // Clean up localStorage when session completes
        localStorage.removeItem("testero_diagnostic_session_id");

        // Redirect to summary page instead of showing inline results
        router.push(`/diagnostic/${sessionId}/summary`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading)
    return (
      <main style={{ padding: 24 }}>
        <div>Loading diagnostic...</div>
      </main>
    );

  if (error) {
    if (error === "session_not_found") {
      return (
        <main
          style={{
            maxWidth: 600,
            margin: "2rem auto",
            padding: 24,
            border: "1px solid #eee",
            borderRadius: 8,
          }}
        >
          <h1>Session Not Found</h1>
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: "#d32f2f", marginBottom: 16 }}>
              Your diagnostic session has expired or could not be found. This can happen if:
            </p>
            <ul style={{ color: "#666", marginBottom: 24 }}>
              <li>The session expired due to inactivity</li>
              <li>The server was restarted during development</li>
              <li>The session ID is invalid</li>
            </ul>
            <p>Please start a new diagnostic test to continue.</p>
          </div>
          <button
            onClick={() => router.push("/diagnostic")}
            style={{
              padding: "12px 32px",
              borderRadius: 6,
              background: "#0070f3",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Start New Diagnostic
          </button>
        </main>
      );
    }

    if (error === "session_expired") {
      return (
        <main
          style={{
            maxWidth: 600,
            margin: "2rem auto",
            padding: 24,
            border: "1px solid #eee",
            borderRadius: 8,
          }}
        >
          <h1>Session Expired</h1>
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: "#d32f2f", marginBottom: 16 }}>
              Your diagnostic session has expired after 30 minutes of inactivity for security
              reasons.
            </p>
            <p>Please start a new diagnostic test to continue.</p>
          </div>
          <button
            onClick={() => router.push("/diagnostic")}
            style={{
              padding: "12px 32px",
              borderRadius: 6,
              background: "#0070f3",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Start New Diagnostic
          </button>
        </main>
      );
    }

    if (error === "too_many_sessions") {
      return (
        <main
          style={{
            maxWidth: 600,
            margin: "2rem auto",
            padding: 24,
            border: "1px solid #eee",
            borderRadius: 8,
          }}
        >
          <h1>Too Many Active Sessions</h1>
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: "#d32f2f", marginBottom: 16 }}>
              You have reached the maximum number of active diagnostic sessions (3).
            </p>
            <p>
              Please complete your existing tests before starting a new one, or wait for them to
              expire.
            </p>
          </div>
          <button
            onClick={() => router.push("/diagnostic")}
            style={{
              padding: "12px 32px",
              borderRadius: 6,
              background: "#0070f3",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go to Diagnostic
          </button>
        </main>
      );
    }

    if (error === "authentication_required") {
      return (
        <main
          style={{
            maxWidth: 600,
            margin: "2rem auto",
            padding: 24,
            border: "1px solid #eee",
            borderRadius: 8,
          }}
        >
          <h1>Authentication Required</h1>
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: "#d32f2f", marginBottom: 16 }}>
              You need to be logged in to access this diagnostic session.
            </p>
          </div>
          <button
            onClick={() => router.push("/login")}
            style={{
              padding: "12px 32px",
              borderRadius: 6,
              background: "#0070f3",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go to Login
          </button>
        </main>
      );
    }

    // Generic error fallback
    return (
      <main
        style={{
          maxWidth: 600,
          margin: "2rem auto",
          padding: 24,
          border: "1px solid #eee",
          borderRadius: 8,
        }}
      >
        <h1>Error</h1>
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "#d32f2f", marginBottom: 16 }}>Error: {error}</p>
        </div>
        <button
          onClick={() => router.push("/diagnostic")}
          style={{
            padding: "12px 32px",
            borderRadius: 6,
            background: "#0070f3",
            color: "white",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Start New Diagnostic
        </button>
      </main>
    );
  }

  if (!currentQuestion)
    return (
      <main style={{ padding: 24 }}>
        <div>No questions found for this session.</div>
      </main>
    );

  return (
    <main
      style={{
        maxWidth: 900, // Increased from 600 to give more breathing room
        margin: "2rem auto",
        padding: "32px 48px", // Increased padding for more spacious feel
        border: "1px solid #eee",
        borderRadius: 12, // Slightly larger border radius
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "3rem", // More space before question
          paddingBottom: "1rem",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>Diagnostic Assessment</h1>
        <div
          style={{
            background: "#f8f9fa",
            padding: "8px 16px",
            borderRadius: 20,
            fontSize: "0.9rem",
            fontWeight: 500,
            color: "#6c757d",
          }}
        >
          Question {currentQuestionIndex + 1} of {sessionData?.questions.length}
        </div>
      </div>

      <section style={{ margin: 0 }}>
        {/* Question stem - clean minimal approach */}
        {/* Other style options to try:
            
            Option 1 - Minimal (current):
            Just typography hierarchy with generous spacing
            
            Option 2 - Accent line:
            Add: paddingBottom: '1.5rem', borderBottom: '3px solid #0070f3'
            
            Option 3 - Left accent bar:  
            Add: paddingLeft: '1.5rem', borderLeft: '4px solid #0070f3'
            
            Option 4 - Question icon:
            Add small Q icon or question mark before text
            
            Option 5 - Typography emphasis:
            Make it larger: fontSize: '1.75rem', fontWeight: 700
        */}
        <div
          style={{
            fontSize: "1.5rem",
            fontWeight: 400, // Reduced from 600 to be less bold
            lineHeight: 1.5,
            marginBottom: "3rem",
            color: "#4a5568", // Lighter color, less dark than #1a202c
            letterSpacing: "-0.01em",
          }}
        >
          {currentQuestion.stem}
        </div>

        {/* Answer options with more spacious layout */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16, // Increased gap between options
            marginBottom: "3rem", // More space before submit button
          }}
        >
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
                  padding: "1.25rem 1.5rem", // More generous padding
                  borderRadius: 8,
                  border: isSelected ? "2px solid #0070f3" : "2px solid #dee2e6", // Keep border thickness consistent
                  background: isCorrectOption
                    ? "#d1fadf"
                    : isIncorrectSelected
                      ? "#ffe0e0"
                      : isSelected
                        ? "#e6f0fd"
                        : "#ffffff",
                  fontWeight: 400, // Keep font weight consistent - no bold on selection
                  fontSize: "1.1rem", // Slightly larger text for options
                  lineHeight: 1.5,
                  color: isCorrectOption
                    ? "#219653"
                    : isIncorrectSelected
                      ? "#d32f2f"
                      : isSelected
                        ? "#0070f3"
                        : "#343a40",
                  transition: "all 0.2s ease", // Smoother transition
                  opacity: isDisabled && !isSelected && !isCorrectOption ? 0.7 : 1,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  textAlign: "left", // Left align for better readability
                  boxSizing: "border-box", // Ensure borders don't affect internal spacing
                  boxShadow: isSelected
                    ? "0 2px 8px rgba(0,112,243,0.15)"
                    : "0 1px 3px rgba(0,0,0,0.05)",
                  transform: isSelected && !isDisabled ? "translateY(-1px)" : "none", // Subtle lift effect
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span>{option.text}</span>
                  <div>
                    {isCorrectOption && feedback && (
                      <span
                        style={{
                          marginLeft: 12,
                          fontWeight: 700,
                          fontSize: "1.2rem",
                          color: "#219653",
                        }}
                      >
                        ✓
                      </span>
                    )}
                    {isIncorrectSelected && feedback && (
                      <span
                        style={{
                          marginLeft: 12,
                          fontWeight: 700,
                          fontSize: "1.2rem",
                          color: "#d32f2f",
                        }}
                      >
                        ✗
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!feedback ? (
          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedOptionLabel === null || submitting}
              style={{
                padding: "16px 48px", // Larger button
                borderRadius: 8,
                background: selectedOptionLabel === null || submitting ? "#ccc" : "#0070f3",
                color: "white",
                border: "none",
                fontWeight: 600,
                fontSize: "1.1rem",
                cursor: selectedOptionLabel === null || submitting ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                boxShadow:
                  selectedOptionLabel !== null && !submitting
                    ? "0 4px 12px rgba(0,112,243,0.3)"
                    : "none",
                transform:
                  selectedOptionLabel !== null && !submitting ? "translateY(-1px)" : "none",
              }}
            >
              {submitting ? "Submitting..." : "Submit Answer"}
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                marginTop: "2rem",
                padding: "2rem",
                background: feedback.isCorrect ? "#f0f9f4" : "#fef2f2",
                borderRadius: 12,
                border: `1px solid ${feedback.isCorrect ? "#d1fae5" : "#fecaca"}`,
                marginBottom: "2rem",
              }}
            >
              <div
                style={{
                  color: feedback.isCorrect ? "#219653" : "#d32f2f",
                  fontWeight: 700,
                  fontSize: "1.25rem",
                  marginBottom: "1rem",
                }}
              >
                {feedback.isCorrect ? "🎉 Correct!" : "❌ Incorrect."}
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: "1.1rem", color: "#374151" }}>Explanation:</strong>
                <div
                  style={{
                    marginTop: "0.75rem",
                    fontSize: "1rem",
                    lineHeight: 1.6,
                    color: "#4b5563",
                  }}
                >
                  {feedback.explanation || "No explanation provided."}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <button
                onClick={handleNextQuestion}
                style={{
                  marginTop: 16,
                  padding: "16px 48px", // Larger button to match submit button
                  borderRadius: 8,
                  background: "#f8f9fa",
                  color: "#495057",
                  border: "1px solid #dee2e6",
                  fontWeight: 600,
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e9ecef";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f8f9fa";
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
                }}
              >
                {currentQuestionIndex < (sessionData?.questions.length || 0) - 1
                  ? "Next Question →"
                  : "View Results →"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default DiagnosticSessionPage;
