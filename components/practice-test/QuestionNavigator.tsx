"use client";

import * as React from "react";
import { NavigatorTile } from "@/components/ui/navigator-tile";

export interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  answeredQuestionIds: Set<string>;
  flaggedQuestionIds: Set<string>;
  questionIds: string[];
  onQuestionClick: (index: number) => void;
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  totalQuestions,
  currentIndex,
  answeredQuestionIds,
  flaggedQuestionIds,
  questionIds,
  onQuestionClick,
}) => {
  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-medium text-slate-900">
          Question {currentIndex + 1} of {totalQuestions}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-2 bg-blue-600 transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question Navigator Grid */}
      <div className="max-h-[400px] space-y-2 overflow-y-auto">
        <div className="grid grid-cols-5 gap-2">
          {questionIds.map((questionId, index) => {
            const isAnswered = answeredQuestionIds.has(questionId);
            const isCurrent = index === currentIndex;
            const isFlagged = flaggedQuestionIds.has(questionId);

            return (
              <NavigatorTile
                key={questionId}
                questionNumber={index + 1}
                onClick={() => onQuestionClick(index)}
                isAnswered={isAnswered}
                isCurrent={isCurrent}
                isFlagged={isFlagged}
              />
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="text-xs text-slate-600">
        <div>Question {currentIndex + 1} of {totalQuestions}</div>
        <div className="mt-1">
          {answeredQuestionIds.size} answered · {totalQuestions - answeredQuestionIds.size} unanswered · {flaggedQuestionIds.size} flagged
        </div>
      </div>
    </div>
  );
};

