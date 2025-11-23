'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { colorSemantic } from '@/lib/design-system';
import { getExamReadinessTier, getExamReadinessSemanticColor } from '@/lib/readiness';

interface ReadinessMeterProps {
  score: number;
  hasCompletedDiagnostic: boolean;
  lastDiagnosticDate?: string | null;
  lastDiagnosticSessionId?: string | null;
  onStartDiagnostic?: () => void;
  onUpgrade?: () => void;
  showUpgradeCTA?: boolean;
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

export const ReadinessMeter: React.FC<ReadinessMeterProps> = ({
  score,
  hasCompletedDiagnostic,
  lastDiagnosticDate,
  lastDiagnosticSessionId,
  onStartDiagnostic,
  onUpgrade,
  showUpgradeCTA,
  className
}) => {
  const displayScore = hasCompletedDiagnostic ? score : 0;
  const tier = hasCompletedDiagnostic ? getExamReadinessTier(displayScore) : null;
  const color = tier ? getExamReadinessSemanticColor(tier.id) : colorSemantic.text.muted;
  const statusText = tier ? tier.label : 'Get started';
  const description = tier ? tier.description : 'Take your first PMLE diagnostic to see your readiness score and get a tailored study plan based on domain-level performance.';

  // Create a circular progress indicator
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

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
                {displayScore}%
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

        {/* Additional info for completed diagnostics */}
        {hasCompletedDiagnostic && (
          <div className="text-center space-y-2 w-full">
            <p className="text-xs" style={{ color: colorSemantic.text.muted }}>
              Based on your latest diagnostic
              {lastDiagnosticDate && ` • ${formatDate(lastDiagnosticDate)}`}
            </p>
            {lastDiagnosticSessionId && (
              <Button asChild size="sm" variant="outline" tone="accent" className="text-xs">
                <Link href={`/diagnostic/${lastDiagnosticSessionId}/summary`}>
                  View results
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Empty state CTA */}
        {!hasCompletedDiagnostic && onStartDiagnostic && (
          <Button onClick={onStartDiagnostic} size="sm" tone="accent" className="w-full max-w-sm">
            Take your first diagnostic
          </Button>
        )}

        {showUpgradeCTA && onUpgrade && (
          <Button onClick={onUpgrade} size="sm" tone="accent" variant="outline" className="w-full max-w-sm">
            Upgrade to Premium
          </Button>
        )}

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
                width: `${displayScore}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};