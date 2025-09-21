'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DiagnosticSession {
  id: string;
  examType: string;
  score: number;
  completedAt: string;
  totalQuestions: number;
  correctAnswers: number;
}

interface DiagnosticSummaryProps {
  sessions: DiagnosticSession[];
  totalSessions: number;
  className?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export const DiagnosticSummary: React.FC<DiagnosticSummaryProps> = ({
  sessions,
  totalSessions,
  className
}) => {
  const hasData = sessions.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">
          Diagnostic Tests
        </CardTitle>
        {hasData && (
          <div className="text-xs text-gray-500">
            {totalSessions} total
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          // Empty state
          <div className="text-center py-6 space-y-3">
            <div className="text-gray-500 text-sm">
              You haven&apos;t taken a diagnostic test yet.
            </div>
            <div className="text-xs text-gray-400">
              Take a diagnostic to assess your current knowledge level
            </div>
            <Button asChild size="sm" tone="accent" className="mt-3">
              <Link href="/diagnostic">
                Start Diagnostic
              </Link>
            </Button>
          </div>
        ) : (
          // Data state
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {session.examType}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(session.completedAt)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {session.correctAnswers}/{session.totalQuestions} correct
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <div className={`text-lg font-bold ${getScoreColor(session.score)}`}>
                    {session.score}%
                  </div>
                  <Button asChild size="sm" variant="outline" tone="accent" className="text-xs">
                    <Link href={`/diagnostic/${session.id}/summary`}>
                      View Results
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Show "View All" if there are more sessions */}
            {totalSessions > sessions.length && (
              <div className="pt-2 border-t border-gray-100">
                <Button asChild variant="outline" tone="accent" size="sm" className="w-full">
                  <Link href="/diagnostic">
                    View All Diagnostics
                  </Link>
                </Button>
              </div>
            )}
            
            {/* CTA for another diagnostic */}
            <div className="pt-2 border-t border-gray-100">
              <Button asChild size="sm" tone="accent" className="w-full">
                <Link href="/diagnostic">
                  Take Another Diagnostic
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};