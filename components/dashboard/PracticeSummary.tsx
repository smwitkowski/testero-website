'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PracticeStats {
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracyPercentage: number;
  lastPracticeDate: string | null;
}

interface PracticeSummaryProps {
  stats: PracticeStats;
  className?: string;
}

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'text-green-600';
  if (accuracy >= 60) return 'text-yellow-600';
  if (accuracy >= 40) return 'text-orange-600';
  return 'text-red-600';
}

export const PracticeSummary: React.FC<PracticeSummaryProps> = ({
  stats,
  className
}) => {
  const hasData = stats.totalQuestionsAnswered > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Practice Questions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          // Empty state
          <div className="text-center py-6 space-y-3">
            <div className="text-gray-500 text-sm">
              You haven&apos;t answered any practice questions yet.
            </div>
            <div className="text-xs text-gray-400">
              Start practicing to improve your exam readiness
            </div>
            <Button asChild size="sm" tone="accent" className="mt-3">
              <Link href="/practice/question">
                Start Practicing
              </Link>
            </Button>
          </div>
        ) : (
          // Data state
          <div className="space-y-4">
            {/* Key Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-gray-50">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.totalQuestionsAnswered}
                </div>
                <div className="text-xs text-gray-500">
                  Questions Answered
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50">
                <div className={`text-2xl font-bold ${getAccuracyColor(stats.accuracyPercentage)}`}>
                  {stats.accuracyPercentage}%
                </div>
                <div className="text-xs text-gray-500">
                  Accuracy
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Correct answers:</span>
                <span className="font-medium">
                  {stats.correctAnswers} / {stats.totalQuestionsAnswered}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last practiced:</span>
                <span className="font-medium">
                  {formatRelativeDate(stats.lastPracticeDate)}
                </span>
              </div>
            </div>

            {/* Progress Indicators */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Accuracy Progress</span>
                <span className="text-gray-500">{stats.accuracyPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ease-in-out ${
                    stats.accuracyPercentage >= 80 ? 'bg-green-500' :
                    stats.accuracyPercentage >= 60 ? 'bg-yellow-500' :
                    stats.accuracyPercentage >= 40 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(stats.accuracyPercentage, 100)}%` }}
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2 border-t border-gray-100">
              <Button asChild size="sm" tone="accent" className="w-full">
                <Link href="/practice/question">
                  Continue Practicing
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};