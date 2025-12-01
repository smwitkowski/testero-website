"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NextBestStepCardProps {
  domain: string;
  questionCount: number;
  estimatedTime: string;
  onStartSession?: () => void;
  onChooseAnotherMode?: () => void;
  className?: string;
}

export const NextBestStepCard: React.FC<NextBestStepCardProps> = ({
  domain,
  questionCount,
  estimatedTime,
  onStartSession,
  onChooseAnotherMode,
  className,
}) => {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Next Best Step</CardTitle>
          <Badge variant="soft" tone="accent" size="sm">
            AI RECOMMENDATION
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Targeted Practice: Strengthen your weakest area based on recent performance.
        </p>

        <div className="p-4 rounded-lg border border-border/60 bg-muted/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground mb-1">{domain}</div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{questionCount} Questions</span>
                <span>{estimatedTime}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={onStartSession} tone="accent" className="w-full">
            Start Session
          </Button>
          <Button
            onClick={onChooseAnotherMode}
            variant="outline"
            className="w-full"
          >
            Choose another mode
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};


