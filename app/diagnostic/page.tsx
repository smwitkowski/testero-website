"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

const DiagnosticStartPage = () => {
  const [examType, setExamType] = useState('Google Cloud Architect');
  const [numQuestions, setNumQuestions] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  const handleStartDiagnostic = async () => {
    // Client-side validation
    if (!examType || typeof examType !== 'string') {
      setError('Please select a valid exam type.');
      return;
    }
    
    if (!numQuestions || numQuestions < 1 || numQuestions > 20) {
      setError('Please select between 1 and 20 questions.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'start',
          data: { examType, numQuestions }
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Handle specific error types
        if (res.status === 429) {
          setError('You have too many active sessions. Please complete your existing tests first.');
        } else if (res.status === 401) {
          setError('Authentication required. Please log in again.');
          router.push('/login');
        } else {
          setError(data.error || 'Failed to start diagnostic.');
        }
        return;
      }

      // Redirect to the diagnostic session page
      router.push(`/diagnostic/${data.sessionId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h1>Start Diagnostic</h1>
      <section style={{ margin: '2rem 0' }}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="examType" style={{ display: 'block', marginBottom: 8 }}>Exam Type:</label>
          <select
            id="examType"
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="Google Cloud Architect">Google Cloud Architect</option>
            <option value="AWS Solutions Architect">AWS Solutions Architect</option>
            <option value="Azure Administrator">Azure Administrator</option>
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
              if (!isNaN(value) && value >= 1 && value <= 20) {
                setNumQuestions(value);
              }
            }}
            min="1"
            max="20"
            step="1"
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666', fontSize: 12 }}>Choose between 1 and 20 questions</small>
        </div>
        <button
          onClick={handleStartDiagnostic}
          disabled={loading || isAuthLoading || !user}
          style={{
            padding: '12px 32px',
            borderRadius: 6,
            background: (loading || isAuthLoading || !user) ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            fontWeight: 600,
            cursor: (loading || isAuthLoading || !user) ? 'not-allowed' : 'pointer',
          }}
        >
          {isAuthLoading ? 'Loading user...' : (loading ? 'Starting...' : 'Start Diagnostic')}
        </button>
        {error && <div style={{ color: 'red', marginTop: 16 }}>Error: {error}</div>}
      </section>
    </main>
  );
};

export default DiagnosticStartPage;
