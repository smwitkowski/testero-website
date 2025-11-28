"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  domainName: string;
  scenario: string;
  questionStem: string;
  options: Array<{ label: string; text: string }>;
  selectedOptionLabel: string | null;
  onOptionSelect: (label: string) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  questionNumber,
  totalQuestions,
  domainName,
  scenario,
  questionStem,
  options,
  selectedOptionLabel,
  onOptionSelect,
}) => {
  return (
    <div className="space-y-6">
      {/* Question Metadata */}
      <div className="flex items-center justify-between">
        <Badge variant="soft" tone="info" size="md">
          Domain: {domainName}
        </Badge>
        <div className="text-sm font-medium text-slate-600">
          Question {questionNumber} of {totalQuestions}
        </div>
      </div>

      {/* Scenario Box */}
      {scenario && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
            {scenario}
          </p>
        </div>
      )}

      {/* Question Stem - only render if different from scenario */}
      {questionStem && questionStem !== scenario && (
        <div className="text-lg font-semibold leading-relaxed text-slate-900">
          {questionStem}
        </div>
      )}

      {/* Answer Options */}
      <div className="space-y-3" role="radiogroup" aria-label="Answer choices">
        {options.map((option) => {
          const isSelected = selectedOptionLabel === option.label;

          return (
            <label
              key={option.label}
              className={cn(
                "relative flex cursor-pointer gap-4 rounded-xl border p-4 transition-all",
                "hover:border-slate-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-1",
                isSelected
                  ? "border-blue-600 bg-blue-50 ring-4 ring-blue-600/10"
                  : "border-slate-200 bg-white"
              )}
            >
              <input
                type="radio"
                name="answer"
                value={option.label}
                checked={isSelected}
                onChange={() => onOptionSelect(option.label)}
                className="sr-only"
                aria-label={`Option ${option.label}`}
              />

              {/* Radio button circle */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "border-2 border-slate-300 bg-white text-slate-700"
                )}
              >
                {option.label}
              </div>

              {/* Option text */}
              <div className="flex-1 text-slate-700 leading-relaxed">
                {option.text}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

