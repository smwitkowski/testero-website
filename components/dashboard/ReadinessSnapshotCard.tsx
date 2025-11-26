"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { colorSemantic } from "@/lib/design-system";
import { getExamReadinessTier, getExamReadinessSemanticColor } from "@/lib/readiness";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReadinessSnapshotCardProps {
  score: number;
  hasCompletedDiagnostic: boolean;
  overallAccuracy: number;
  blueprintCoverage: number;
  periodContext?: string;
  weakestDomain?: string;
  weakestDomainWeight?: number;
  lastDiagnosticDate?: string | null;
  lastDiagnosticSessionId?: string | null;
  onStartDiagnostic?: () => void;
  onUpgrade?: () => void;
  showUpgradeCTA?: boolean;
  className?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const ReadinessSnapshotCard: React.FC<ReadinessSnapshotCardProps> = ({
  score,
  hasCompletedDiagnostic,
  overallAccuracy,
  blueprintCoverage,
  periodContext = "Based on last 7 days of practice",
  weakestDomain,
  weakestDomainWeight,
  lastDiagnosticDate,
  lastDiagnosticSessionId,
  onStartDiagnostic,
  onUpgrade,
  showUpgradeCTA,
  className,
}) => {
  const displayScore = hasCompletedDiagnostic ? score : 0;
  const tier = hasCompletedDiagnostic ? getExamReadinessTier(displayScore) : null;
  const color = tier ? getExamReadinessSemanticColor(tier.id) : colorSemantic.text.muted;
  const statusText = tier ? tier.label.toUpperCase() : "GET STARTED";

  // Create a circular progress indicator
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Readiness Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Badge and Circular Score */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Badge variant="soft" tone="accent" className="mb-3">
              {statusText}
            </Badge>
            <p className="text-xs text-muted-foreground">{periodContext}</p>
          </div>
          {/* Circular Progress */}
          <div className="relative flex-shrink-0">
            <svg
              width="80"
              height="80"
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
            {/* Score text in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color }}>
                  {displayScore}
                </div>
                <div className="text-xs text-muted-foreground">Readiness score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/60">
          <div>
            <div className="text-sm text-muted-foreground">Overall accuracy</div>
            <div className="text-lg font-semibold text-foreground">
              {overallAccuracy}%
            </div>
            <div className="text-xs text-muted-foreground">Over last 120 questions</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Blueprint coverage</div>
            <div className="text-lg font-semibold text-foreground">
              {blueprintCoverage}%
            </div>
            <div className="text-xs text-muted-foreground">Portion of exam domains touched</div>
          </div>
        </div>

        {/* Insight Text */}
        {weakestDomain && weakestDomainWeight && (
          <div className="pt-4 border-t border-border/60">
            <p className="text-sm text-foreground">
              You&apos;re strong in Project Initiation but underweight on{" "}
              <strong>{weakestDomain}</strong>, which carries {weakestDomainWeight}% of the exam.{" "}
              <Link
                href={`/practice/question?domain=${encodeURIComponent(weakestDomain)}`}
                className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
              >
                Practice {weakestDomain} now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </p>
          </div>
        )}

        {/* Empty state CTA */}
        {!hasCompletedDiagnostic && onStartDiagnostic && (
          <div className="pt-4 border-t border-border/60">
            <Button onClick={onStartDiagnostic} tone="accent" className="w-full">
              Take your first diagnostic
            </Button>
          </div>
        )}

        {showUpgradeCTA && onUpgrade && (
          <div className="pt-4 border-t border-border/60">
            <Button onClick={onUpgrade} variant="outline" tone="accent" className="w-full">
              Upgrade to Premium
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Export ReadinessMeter as alias for backwards compatibility
export const ReadinessMeter = ReadinessSnapshotCard;

