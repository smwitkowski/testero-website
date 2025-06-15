'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReadinessMeterProps {
  score: number;
  className?: string;
}

function getReadinessColor(score: number): string {
  if (score >= 80) return '#10B981'; // Green - Ready
  if (score >= 60) return '#F59E0B'; // Yellow - Almost ready
  if (score >= 40) return '#EF4444'; // Red - Needs work
  return '#6B7280'; // Gray - Just started
}

function getReadinessText(score: number): string {
  if (score >= 80) return 'Exam Ready!';
  if (score >= 60) return 'Almost Ready';
  if (score >= 40) return 'Needs Work';
  if (score > 0) return 'Getting Started';
  return 'Not Started';
}

function getReadinessDescription(score: number): string {
  if (score >= 80) return 'You\'re well-prepared for the exam. Keep practicing to maintain your knowledge.';
  if (score >= 60) return 'You\'re making good progress. Focus on your weak areas to reach exam readiness.';
  if (score >= 40) return 'You\'re on the right track. More practice in key areas will improve your readiness.';
  if (score > 0) return 'You\'ve started your journey. Take diagnostic tests and practice regularly.';
  return 'Take a diagnostic test to assess your current knowledge level.';
}

export const ReadinessMeter: React.FC<ReadinessMeterProps> = ({ score, className }) => {
  const color = getReadinessColor(score);
  const statusText = getReadinessText(score);
  const description = getReadinessDescription(score);

  // Create a circular progress indicator
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-center">Exam Readiness</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {/* Circular Progress */}
        <div className="relative">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="#E5E7EB"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke={color}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-in-out"
            />
          </svg>
          {/* Percentage text in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color }}>
                {score}%
              </div>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold" style={{ color }}>
            {statusText}
          </h3>
          <p className="text-sm text-gray-600 max-w-sm">
            {description}
          </p>
        </div>

        {/* Progress bar for mobile/alternative view */}
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>0%</span>
            <span>100%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500 ease-in-out"
              style={{
                width: `${score}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};