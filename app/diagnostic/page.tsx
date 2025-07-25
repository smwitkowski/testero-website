"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider'; // Assuming this is still relevant for logged-in users
import { usePostHog } from 'posthog-js/react';
import { 
  getAnonymousSessionId, 
  setAnonymousSessionId, 
  generateAnonymousSessionId 
} from '@/lib/auth/anonymous-session';

interface ExamTypeOption {
  name: string; // This will be the value sent to the API (e.g., "Google Professional ML Engineer")
  displayName: string; // This will be shown in the dropdown (e.g., "Google ML Engineer")
}

const DiagnosticStartPage = () => {
  const [examTypes, setExamTypes] = useState<ExamTypeOption[]>([]);
  const [selectedExamName, setSelectedExamName] = useState<string>(''); // Store the 'name' field for API
  const [numQuestions, setNumQuestions] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeSession, setResumeSession] = useState<{
    sessionId: string;
    examType: string;
    startedAt: string;
  } | null>(null);
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth(); // Keep auth for logged-in user tracking
  const posthog = usePostHog();

  useEffect(() => {
    // Fetch exam types - this part does not require authentication as per new requirements
    const fetchExamTypes = async () => {
      try {
        // This endpoint needs to be created or use an existing one that lists exams
        // For now, let's assume a simple GET to /api/exams (needs implementation)
        // Or, for MVP, we can hardcode them if an API endpoint is too much scope now
        // Based on previous DB query, we have:
        const fetchedExams: ExamTypeOption[] = [
          { name: "Google Professional ML Engineer", displayName: "Google ML Engineer" },
          { name: "Google Cloud Digital Leader", displayName: "Google Cloud Digital Leader" },
          { name: "Google Cloud Professional Cloud Architect", displayName: "Google Cloud Architect" },
          // Add others if needed
        ];
        setExamTypes(fetchedExams);
        if (fetchedExams.length > 0) {
          setSelectedExamName(fetchedExams[0].name); // Default to first exam
        }
      } catch (err) {
        console.error("Failed to fetch exam types", err);
        setError("Could not load exam types.");
        // Fallback to a default if fetch fails
        const fallbackExams: ExamTypeOption[] = [{ name: "Google Professional ML Engineer", displayName: "Google ML Engineer" }];
        setExamTypes(fallbackExams);
        setSelectedExamName(fallbackExams[0].name);
      }
    };
    fetchExamTypes();
  }, []);

  useEffect(() => {
    // Check for unfinished session on page load
    const checkUnfinishedSession = async () => {
      if (isAuthLoading) return; // Wait for auth state to load
      
      const storedSessionId = localStorage.getItem('testero_diagnostic_session_id');
      if (!storedSessionId) return;

      try {
        let statusUrl = `/api/diagnostic/session/${storedSessionId}/status`;
        
        // Include anonymous session ID if user is not logged in
        if (!user) {
          const anonymousSessionId = getAnonymousSessionId();
          if (anonymousSessionId) {
            statusUrl += `?anonymousSessionId=${anonymousSessionId}`;
          }
        }

        const response = await fetch(statusUrl);
        const data = await response.json();

        if (data.exists && data.status === 'active') {
          setResumeSession({
            sessionId: storedSessionId,
            examType: data.examType,
            startedAt: data.startedAt
          });
          
          // Track resume opportunity shown
          posthog?.capture('diagnostic_resume_shown', {
            sessionId: storedSessionId,
            examType: data.examType,
            startedAt: data.startedAt
          });
        } else if (data.status === 'completed' || data.status === 'expired' || data.status === 'not_found') {
          // Clean up localStorage for completed/expired/not found sessions
          localStorage.removeItem('testero_diagnostic_session_id');
        }
      } catch (err) {
        console.error('Error checking session status:', err);
        // Clean up localStorage on error
        localStorage.removeItem('testero_diagnostic_session_id');
      }
    };

    checkUnfinishedSession();
  }, [user, isAuthLoading, posthog]);

  // No longer forcing login for this page
  // useEffect(() => {
  //   if (!isAuthLoading && !user) {
  //     router.push('/login');
  //   }
  // }, [user, isAuthLoading, router]);

  const handleResumeSession = () => {
    if (resumeSession) {
      // Track resume action
      posthog?.capture('diagnostic_resumed', {
        sessionId: resumeSession.sessionId,
        examType: resumeSession.examType,
        startedAt: resumeSession.startedAt
      });
      
      router.push(`/diagnostic/${resumeSession.sessionId}`);
    }
  };

  const handleStartOver = () => {
    // Clear stored session data
    localStorage.removeItem('testero_diagnostic_session_id');
    setResumeSession(null);
  };

  const handleStartDiagnostic = async () => {
    if (!selectedExamName) {
      setError('Please select a valid exam type.');
      return;
    }
    
    if (!numQuestions || numQuestions < 1 || numQuestions > 20) {
      setError('Please select between 1 and 20 questions.');
      return;
    }
    
    setLoading(true);
    setError(null);

    const requestBody: {
      action: 'start';
      data: { examType: string; numQuestions: number; anonymousSessionId?: string };
    } = {
      action: 'start',
      data: {
        examType: selectedExamName, // Send the 'name' field
        numQuestions
      }
    };

    // For anonymous users, try to send existing anonymousSessionId for potential resume
    if (!user) {
      let anonymousSessionId = getAnonymousSessionId();
      if (!anonymousSessionId) {
        // Generate new anonymous session ID if none exists
        anonymousSessionId = generateAnonymousSessionId();
        setAnonymousSessionId(anonymousSessionId);
      }
      requestBody.data.anonymousSessionId = anonymousSessionId;
    }

    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseData = await res.json();
      if (!res.ok) {
        // Error handling remains similar, but 429 (too many sessions) is removed
        // 401 might still occur if a logged-in user's token expires, but not for anonymous
        if (res.status === 401 && user) { // Only redirect to login if it was an auth issue for a logged-in user
          setError('Authentication issue. Please log in again.');
          router.push('/login');
        } else {
          setError(responseData.error || 'Failed to start diagnostic.');
        }
        return;
      }

      // If API returns a new anonymousSessionId (for new anonymous sessions), store it
      if (responseData.anonymousSessionId && !user) {
        setAnonymousSessionId(responseData.anonymousSessionId);
      }
      
      // Store diagnostic session ID in localStorage for session persistence
      localStorage.setItem('testero_diagnostic_session_id', responseData.sessionId);
      
      // If it was a resumed session, the API might indicate it. For now, just redirect.
      router.push(`/diagnostic/${responseData.sessionId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Determine if the main button should be disabled
  // Auth loading is relevant if a user *might* be logged in.
  // If strictly anonymous, isAuthLoading might not be as critical here,
  // but keeping it for cases where a user *is* logged in.
  const isButtonDisabled = loading || (user && isAuthLoading) || examTypes.length === 0;


  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h1>Start Diagnostic</h1>
      
      {resumeSession && (
        <section style={{ 
          margin: '2rem 0', 
          padding: '1rem', 
          backgroundColor: '#f0f8ff', 
          border: '1px solid #0070f3', 
          borderRadius: 6 
        }}>
          <h2 style={{ margin: '0 0 1rem 0', color: '#0070f3' }}>Unfinished Diagnostic Found</h2>
          <p style={{ margin: '0 0 1rem 0' }}>
            You have an unfinished <strong>{resumeSession.examType}</strong> diagnostic 
            started on {new Date(resumeSession.startedAt).toLocaleString()}.
          </p>
          <p style={{ margin: '0 0 1rem 0' }}>Would you like to resume or start over?</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleResumeSession}
              style={{
                padding: '10px 20px',
                borderRadius: 6,
                background: '#0070f3',
                color: 'white',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Resume
            </button>
            <button
              onClick={handleStartOver}
              style={{
                padding: '10px 20px',
                borderRadius: 6,
                background: '#fff',
                color: '#666',
                border: '1px solid #ccc',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Start Over
            </button>
          </div>
        </section>
      )}
      
      <section style={{ margin: '2rem 0' }}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="examType" style={{ display: 'block', marginBottom: 8 }}>Exam Type:</label>
          <select
            id="examType"
            value={selectedExamName}
            onChange={(e) => setSelectedExamName(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            disabled={examTypes.length === 0}
          >
            {examTypes.length === 0 && <option>Loading exams...</option>}
            {examTypes.map((exam) => (
              <option key={exam.name} value={exam.name}>
                {exam.displayName}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="numQuestions" style={{ display: 'block', marginBottom: 8 }}>Number of Questions:</label>
          <input
            type="number"
            id="numQuestions"
            value={numQuestions}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value) && value >= MIN_QUESTIONS && value <= MAX_QUESTIONS) { // Use constants
                setNumQuestions(value);
              }
            }}
            min={MIN_QUESTIONS} // Use constants
            max={MAX_QUESTIONS} // Use constants
            step="1"
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666', fontSize: 12 }}>Choose between {MIN_QUESTIONS} and {MAX_QUESTIONS} questions</small>
        </div>
        <button
          onClick={handleStartDiagnostic}
          disabled={isButtonDisabled}
          style={{
            padding: '12px 32px',
            borderRadius: 6,
            background: isButtonDisabled ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            fontWeight: 600,
            cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          { (user && isAuthLoading) ? 'Loading user...' : (loading ? 'Starting...' : 'Start Diagnostic') }
        </button>
        {error && <div style={{ color: 'red', marginTop: 16 }}>Error: {error}</div>}
      </section>
    </main>
  );
};

// Constants for question limits, could be imported from a shared config
const MIN_QUESTIONS = 1; 
const MAX_QUESTIONS = 20;

export default DiagnosticStartPage;
