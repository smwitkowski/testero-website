'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { colorSemantic } from '@/lib/design-system';
import { getExamReadinessTier, getExamReadinessSemanticColor } from '@/lib/readiness';

interface ReadinessMeterProps {
  score: number;
  className?: string;
}

export const ReadinessMeter: React.FC<ReadinessMeterProps> = ({ score, className }) => {
  const tier = getExamReadinessTier(score);
  const color = getExamReadinessSemanticColor(tier.id);
  const statusText = tier.label;
  const description = tier.description;

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
              stroke={colorSemantic.border.default}
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
          <p className="text-sm max-w-sm" style={{ color: colorSemantic.text.secondary }}>
            {description}
          </p>
        </div>

        {/* Progress bar for mobile/alternative view */}
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs mb-1" style={{ color: colorSemantic.text.muted }}>
            <span>0%</span>
            <span>100%</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ backgroundColor: colorSemantic.border.default }}>
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