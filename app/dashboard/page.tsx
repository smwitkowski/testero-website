'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ReadinessMeter } from '@/components/dashboard/ReadinessMeter';
import { DiagnosticSummary } from '@/components/dashboard/DiagnosticSummary';
import { PracticeSummary } from '@/components/dashboard/PracticeSummary';

// Import types from the API route
import type { DashboardData, SuccessResponse, ErrorResponse } from '@/app/api/dashboard/route';

const DashboardPage = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // If no user after auth loading completes, they'll be redirected by AuthProvider
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/dashboard');
        const data: SuccessResponse | ErrorResponse = await response.json();

        if (!response.ok) {
          throw new Error((data as ErrorResponse).error || 'Failed to fetch dashboard data');
        }

        setDashboardData((data as SuccessResponse).data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, authLoading]);

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h2 className="text-lg font-semibold text-red-800 mb-2">
                Error Loading Dashboard
              </h2>
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show dashboard content
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">No dashboard data available</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Dashboard
            </h1>
            <p className="text-gray-600">
              Track your progress and exam readiness
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Readiness Meter - Full width on mobile, spans 2 cols on desktop */}
            <div className="lg:col-span-2">
              <ReadinessMeter 
                score={dashboardData.readinessScore} 
                className="h-full"
              />
            </div>

            {/* Practice Summary */}
            <div className="lg:col-span-1">
              <PracticeSummary 
                stats={dashboardData.practice}
                className="h-full"
              />
            </div>

            {/* Diagnostic Summary - Full width */}
            <div className="lg:col-span-3">
              <DiagnosticSummary
                sessions={dashboardData.diagnostic.recentSessions}
                totalSessions={dashboardData.diagnostic.totalSessions}
              />
            </div>
          </div>

          {/* Additional Info/Tips Section */}
          {dashboardData.readinessScore === 0 && (
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Get Started with Your Study Journey
              </h3>
              <p className="text-blue-700 mb-4">
                Welcome to your dashboard! To get the most accurate readiness assessment:
              </p>
              <ul className="text-blue-700 space-y-1 text-sm list-disc list-inside">
                <li>Take a diagnostic test to assess your current knowledge</li>
                <li>Practice regularly with our question bank</li>
                <li>Track your progress over time</li>
                <li>Focus on areas where you need improvement</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;