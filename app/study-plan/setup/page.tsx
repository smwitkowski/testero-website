"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

interface PrefillData {
  domainBreakdown: Array<{ domain: string; correct: number; total: number; percentage: number }>;
  recommendedFocusAreas: string[];
}

const StudyPlanSetupPage = () => {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('fromDiagnostic');
  const { user } = useAuth();
  const [data, setData] = useState<PrefillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrefill = async () => {
      if (!diagnosticId) {
        setLoading(false);
        return;
      }
      let apiUrl = `/api/study-plan/prefill?diagnosticId=${diagnosticId}`;
      if (!user) {
        const anonId = localStorage.getItem('anonymousSessionId');
        if (anonId) apiUrl += `&anonymousSessionId=${anonId}`;
      }
      try {
        const res = await fetch(apiUrl);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to load data');
        } else {
          setData(json);
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchPrefill();
  }, [diagnosticId, user]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Study Plan Setup</h1>
      {data ? (
        <div>
          <h2 className="font-semibold mb-2">Recommended Focus Areas</h2>
          <ul className="list-disc list-inside mb-4">
            {data.recommendedFocusAreas.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>No diagnostic data found.</p>
      )}
    </main>
  );
};

export default StudyPlanSetupPage;
