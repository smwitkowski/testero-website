"use client";

import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NextBestStepCardProps {
  domain: string;
  questionCount: number;
  estimatedTime?: string;
  domainWeight?: number;
  onDomainCardClick?: () => void;
  onTakeMoreQuestions?: () => void;
  className?: string;
}

export const NextBestStepCard: React.FC<NextBestStepCardProps> = ({
  domain,
  questionCount,
  domainWeight,
  onDomainCardClick,
  className,
  // estimatedTime and onTakeMoreQuestions kept in interface for backward compatibility
  // but not used in current single-purpose card implementation
}) => {
  return (
    <Card className={cn("h-full hover:translate-y-0 hover:shadow-sm", className)}>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Next Best Step</CardTitle>
          <Badge variant="soft" tone="accent" size="sm">
            AI RECOMMENDATION
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Insight Text */}
        {domainWeight && (
          <p className="text-sm text-foreground">
            You&apos;re strong in Project Initiation but underweight on{" "}
            <strong>{domain}</strong>, which carries {domainWeight}% of the exam.
          </p>
        )}
      </CardContent>

      {/* Primary CTA Button */}
      {onDomainCardClick && (
        <CardFooter className="justify-start">
          <Button
            onClick={onDomainCardClick}
            tone="accent"
            className="h-auto py-4 w-full max-w-md"
            icon={<Target className="w-5 h-5" />}
            iconRight={<ArrowRight className="w-5 h-5" />}
            aria-label={`Start recommended practice set for ${domain}`}
          >
            <span className="flex flex-col items-start text-left flex-1">
              <span className="font-semibold">Practice {domain}</span>
              <span className="text-sm opacity-80 font-normal">{questionCount} questions</span>
            </span>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};



