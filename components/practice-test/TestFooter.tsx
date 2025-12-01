"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TestFooterProps {
  questionNumber: number;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  flaggedCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
}

export const TestFooter: React.FC<TestFooterProps> = ({
  questionNumber,
  totalQuestions,
  answeredCount,
  unansweredCount,
  flaggedCount,
  onPrevious,
  onNext,
  onSubmit,
  isFirstQuestion,
  isLastQuestion,
}) => {
  return (
    <footer className="sticky bottom-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side: Status */}
          <div className="text-sm text-slate-600">
            <div className="font-medium">Question {questionNumber} of {totalQuestions}</div>
            <div className="mt-1">
              {answeredCount} answered · {unansweredCount} unanswered · {flaggedCount} flagged
            </div>
          </div>

          {/* Right side: Navigation buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              tone="neutral"
              size="md"
              onClick={onPrevious}
              disabled={isFirstQuestion}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Previous
            </Button>
            {isLastQuestion ? (
              <Button
                variant="solid"
                tone="accent"
                size="md"
                onClick={onSubmit}
              >
                Submit Test
              </Button>
            ) : (
              <Button
                variant="solid"
                tone="accent"
                size="md"
                onClick={onNext}
                iconRight={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};



