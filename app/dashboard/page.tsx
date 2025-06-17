'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ReadinessMeter } from '@/components/dashboard/ReadinessMeter';
import { DiagnosticSummary } from '@/components/dashboard/DiagnosticSummary';
import { PracticeSummary } from '@/components/dashboard/PracticeSummary';
import { Button } from '@/components/ui/button';
import { colorSemantic } from '@/lib/design-system';

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
      <div className="min-h-screen" style={{ backgroundColor: colorSemantic.background.default }}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div style={{ color: colorSemantic.text.muted }}>Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: colorSemantic.background.default }}>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-lg p-6 text-center border" style={{ 
              backgroundColor: colorSemantic.error.light, 
              borderColor: colorSemantic.error.base + '40' 
            }}>
              <h2 className="text-lg font-semibold mb-2" style={{ color: colorSemantic.error.dark }}>
                Error Loading Dashboard
              </h2>
              <p className="mb-4" style={{ color: colorSemantic.error.base }}>{error}</p>
              <Button
                onClick={() => window.location.reload()}
                variant="destructive"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show dashboard content
  if (!dashboardData) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: colorSemantic.background.default }}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div style={{ color: colorSemantic.text.muted }}>No dashboard data available</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colorSemantic.background.default }}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: colorSemantic.text.primary }}>
              Dashboard
            </h1>
            <p style={{ color: colorSemantic.text.secondary }}>
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
            <div className="mt-8 rounded-lg p-6 border" style={{ 
              backgroundColor: colorSemantic.info.light,
              borderColor: colorSemantic.info.base + '40'
            }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: colorSemantic.info.dark }}>
                Get Started with Your Study Journey
              </h3>
              <p className="mb-4" style={{ color: colorSemantic.info.base }}>
                Welcome to your dashboard! To get the most accurate readiness assessment:
              </p>
              <ul className="space-y-1 text-sm list-disc list-inside" style={{ color: colorSemantic.info.base }}>
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