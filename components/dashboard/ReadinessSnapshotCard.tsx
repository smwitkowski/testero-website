"use client";

import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { colorSemantic } from "@/lib/design-system";
import { getExamReadinessTier, getExamReadinessSemanticColor } from "@/lib/readiness";
import { cn } from "@/lib/utils";

export interface ReadinessSnapshotCardProps {
  score: number;
  hasCompletedDiagnostic: boolean;
  overallAccuracy: number;
  blueprintCoverage: number;
  periodContext?: string;
  onStartDiagnostic?: () => void;
  className?: string;
}

export const ReadinessSnapshotCard: React.FC<ReadinessSnapshotCardProps> = ({
  score,
  hasCompletedDiagnostic,
  overallAccuracy,
  blueprintCoverage,
  periodContext = "Based on last 7 days of practice",
  onStartDiagnostic,
  className,
}) => {
  const displayScore = hasCompletedDiagnostic ? score : 0;
  const tier = hasCompletedDiagnostic ? getExamReadinessTier(displayScore) : null;
  const color = tier ? getExamReadinessSemanticColor(tier.id) : colorSemantic.text.muted;
  const statusText = tier ? tier.label.toUpperCase() : "GET STARTED";

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Readiness Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Badge and Score Percentage */}
        <div className="flex items-center justify-between mb-3">
          <Badge variant="soft" tone="accent">
            {statusText}
          </Badge>
          {hasCompletedDiagnostic && (
            <span className="text-2xl font-bold" style={{ color }}>
              {displayScore}%
            </span>
          )}
        </div>

        {/* Horizontal Progress Bar */}
        {hasCompletedDiagnostic && (
          <div className="w-full h-2 rounded-full" style={{ backgroundColor: colorSemantic.border.default + "40" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${displayScore}%`,
                backgroundColor: color,
              }}
            />
          </div>
        )}

        {/* Period Context */}
        <p className="text-xs text-muted-foreground">{periodContext}</p>
      </CardContent>

      {/* Footer: Stats or CTA */}
      {hasCompletedDiagnostic ? (
        <CardFooter>
          <div className="grid grid-cols-2 gap-4 w-full">
            <div>
              <div className="text-sm text-muted-foreground">Overall accuracy</div>
              <div className="text-2xl font-semibold text-foreground">
                {overallAccuracy}%
              </div>
              <div className="text-xs text-muted-foreground">Last 7 days</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Blueprint coverage</div>
              <div className="text-2xl font-semibold text-foreground">
                {blueprintCoverage}%
              </div>
              <div className="text-xs text-muted-foreground">Exam domains covered</div>
            </div>
          </div>
        </CardFooter>
      ) : onStartDiagnostic ? (
        <CardFooter>
          <Button onClick={onStartDiagnostic} tone="accent" className="w-full">
            Take your first diagnostic
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
};

// Export ReadinessMeter as alias for backwards compatibility
export const ReadinessMeter = ReadinessSnapshotCard;

