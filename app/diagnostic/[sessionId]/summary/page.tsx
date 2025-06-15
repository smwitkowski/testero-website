"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePostHog } from 'posthog-js/react';

interface QuestionSummary {
  id: string;
  stem: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  options: Array<{
    label: string;
    text: string;
  }>;
}

interface SessionSummary {
  sessionId: string;
  examType: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  startedAt: string;
  completedAt: string;
  questions: QuestionSummary[];
}

interface DomainBreakdown {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

const DiagnosticSummaryPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const posthog = usePostHog();
  const sessionId = params?.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [domainBreakdown, setDomainBreakdown] = useState<DomainBreakdown[]>([]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!sessionId) {
        setError('Session ID not found');
        setLoading(false);
        return;
      }

      if (isAuthLoading) {
        return; // Wait for auth state
      }

      try {
        let apiUrl = `/api/diagnostic/summary/${sessionId}`;
        
        // Include anonymous session ID if user is not logged in
        if (!user) {
          const anonymousSessionId = localStorage.getItem('anonymousSessionId');
          if (anonymousSessionId) {
            apiUrl += `?anonymousSessionId=${anonymousSessionId}`;
          }
        }

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setError('session_not_found');
          } else if (response.status === 403) {
            setError('access_denied');
          } else if (response.status === 400) {
            setError('session_not_completed');
          } else {
            setError(data.error || 'Failed to load summary');
          }
          return;
        }

        setSummary(data.summary);
        setDomainBreakdown(data.domainBreakdown || []);
        
        // Track summary view
        posthog?.capture('diagnostic_summary_viewed', {
          sessionId: data.summary.sessionId,
          examType: data.summary.examType,
          score: data.summary.score,
          totalQuestions: data.summary.totalQuestions,
          correctAnswers: data.summary.correctAnswers,
          domainCount: data.domainBreakdown?.length || 0
        });
        
        // Clean up localStorage since session is completed
        localStorage.removeItem('testero_diagnostic_session_id');
        
      } catch (err) {
        console.error('Error fetching summary:', err);
        setError('Failed to load diagnostic summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [sessionId, user, isAuthLoading, posthog]);

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: '2rem auto', padding: 24 }}>
        <div>Loading diagnostic summary...</div>
      </main>
    );
  }

  if (error === 'session_not_found') {
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
        <h1>Summary Not Found</h1>
        <p style={{ color: '#d32f2f', marginBottom: 16 }}>
          The diagnostic session could not be found or may have expired.
        </p>
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

  if (error === 'access_denied') {
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
        <h1>Access Denied</h1>
        <p style={{ color: '#d32f2f', marginBottom: 16 }}>
          You don&apos;t have permission to view this diagnostic summary.
        </p>
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

  if (error === 'session_not_completed') {
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
        <h1>Diagnostic Not Completed</h1>
        <p style={{ color: '#d32f2f', marginBottom: 16 }}>
          This diagnostic session hasn&apos;t been completed yet.
        </p>
        <button
          onClick={() => router.push(`/diagnostic/${sessionId}`)}
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
          Continue Diagnostic
        </button>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
        <h1>Error</h1>
        <p style={{ color: '#d32f2f', marginBottom: 16 }}>
          {error}
        </p>
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

  if (!summary) {
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24 }}>
        <div>No summary data available</div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h1>Diagnostic Results</h1>
      
      {/* Overall Score Section */}
      <section style={{ margin: '2rem 0', padding: '1.5rem', backgroundColor: '#f9f9f9', borderRadius: 8 }}>
        <h2 style={{ margin: '0 0 1rem 0' }}>Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: summary.score >= 70 ? '#22c55e' : summary.score >= 50 ? '#f59e0b' : '#ef4444' }}>
              {summary.score}%
            </div>
            <div style={{ color: '#666' }}>Overall Score</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {summary.correctAnswers}/{summary.totalQuestions}
            </div>
            <div style={{ color: '#666' }}>Correct Answers</div>
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              {summary.examType}
            </div>
            <div style={{ color: '#666' }}>Exam Type</div>
          </div>
        </div>
      </section>

      {/* Domain Breakdown */}
      {domainBreakdown.length > 0 && (
        <section style={{ margin: '2rem 0' }}>
          <h2>Score by Domain</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {domainBreakdown.map((domain, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0.75rem',
                backgroundColor: '#f9f9f9',
                borderRadius: 6
              }}>
                <span style={{ fontWeight: 500 }}>{domain.domain}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span>{domain.correct}/{domain.total}</span>
                  <div style={{ 
                    width: '100px', 
                    height: '8px', 
                    backgroundColor: '#e5e5e5', 
                    borderRadius: 4,
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: `${domain.percentage}%`, 
                      height: '100%', 
                      backgroundColor: domain.percentage >= 70 ? '#22c55e' : domain.percentage >= 50 ? '#f59e0b' : '#ef4444',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <span style={{ fontWeight: 'bold', minWidth: '40px' }}>
                    {domain.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Question-by-Question Breakdown */}
      <section style={{ margin: '2rem 0' }}>
        <h2>Question Details</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {summary.questions.map((question, index) => (
            <div key={question.id} style={{ 
              border: '1px solid #e5e5e5', 
              borderRadius: 8, 
              padding: '1rem',
              backgroundColor: question.isCorrect ? '#f0f9ff' : '#fef2f2'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 'bold' }}>Question {index + 1}</span>
                <span style={{ 
                  padding: '2px 8px', 
                  borderRadius: 4, 
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  backgroundColor: question.isCorrect ? '#22c55e' : '#ef4444',
                  color: 'white'
                }}>
                  {question.isCorrect ? 'CORRECT' : 'INCORRECT'}
                </span>
              </div>
              <div style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
                {question.stem}
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {question.options.map((option) => {
                  const isUserAnswer = option.label === question.userAnswer;
                  const isCorrectAnswer = option.label === question.correctAnswer;
                  
                  return (
                    <div key={option.label} style={{
                      padding: '0.5rem',
                      borderRadius: 4,
                      backgroundColor: isCorrectAnswer 
                        ? '#dcfce7' 
                        : isUserAnswer && !isCorrectAnswer 
                        ? '#fee2e2' 
                        : '#f9f9f9',
                      border: isUserAnswer ? '2px solid #0070f3' : '1px solid #e5e5e5',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{ fontWeight: 'bold', minWidth: '20px' }}>
                        {option.label}.
                      </span>
                      <span>{option.text}</span>
                      {isCorrectAnswer && (
                        <span style={{ marginLeft: 'auto', color: '#22c55e', fontWeight: 'bold' }}>
                          ✓ Correct
                        </span>
                      )}
                      {isUserAnswer && !isCorrectAnswer && (
                        <span style={{ marginLeft: 'auto', color: '#ef4444', fontWeight: 'bold' }}>
                          ✗ Your Answer
                        </span>
                      )}
                      {isUserAnswer && isCorrectAnswer && (
                        <span style={{ marginLeft: 'auto', color: '#22c55e', fontWeight: 'bold' }}>
                          ✓ Your Answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Action Buttons */}
      <section style={{ margin: '2rem 0', textAlign: 'center' }}>
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
            marginRight: '1rem'
          }}
        >
          Take Another Diagnostic
        </button>
        <button
          onClick={() => {
            // Placeholder for future study plan functionality
            alert('Study plan feature coming soon!');
          }}
          style={{
            padding: '12px 32px',
            borderRadius: 6,
            background: '#22c55e',
            color: 'white',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Start My Study Plan
        </button>
      </section>
    </main>
  );
};

export default DiagnosticSummaryPage;