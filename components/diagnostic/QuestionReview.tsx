import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QuestionSummary } from "./types";

interface QuestionReviewProps {
  questions: QuestionSummary[];
  expandable?: boolean;
  groupByDomain?: boolean;
  filter?: "all" | "correct" | "incorrect";
  filterFn?: (question: QuestionSummary) => boolean;
}

export const QuestionReview: React.FC<QuestionReviewProps> = ({
  questions,
  expandable = false,
  groupByDomain = false,
  filter = "all",
  filterFn,
}) => {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Apply filtering
  let filteredQuestions = questions;
  if (filterFn) {
    filteredQuestions = questions.filter(filterFn);
  } else if (filter !== "all") {
    filteredQuestions = questions.filter((q) =>
      filter === "correct" ? q.isCorrect : !q.isCorrect
    );
  }

  // Group by domain if requested
  const groupedQuestions = groupByDomain
    ? filteredQuestions.reduce(
        (acc, question) => {
          const domain = question.domain || "Other";
          if (!acc[domain]) {
            acc[domain] = [];
          }
          acc[domain].push(question);
          return acc;
        },
        {} as Record<string, QuestionSummary[]>
      )
    : { "": filteredQuestions };

  const toggleExpand = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const isLongQuestion = (question: QuestionSummary) => {
    const totalLength =
      question.stem.length + question.options.reduce((sum, opt) => sum + opt.text.length, 0);
    return totalLength > 300;
  };

  if (filteredQuestions.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No questions to review</p>
        </CardContent>
      </Card>
    );
  }

  const renderQuestion = (question: QuestionSummary, index: number) => {
    const isExpanded = expandedQuestions.has(question.id);
    const shouldShowExpandButton = expandable && isLongQuestion(question);
    const isCollapsed = shouldShowExpandButton && !isExpanded;

    return (
      <div
        key={question.id}
        data-testid={`question-${question.id}`}
        className={cn(
          "mb-4 rounded-lg border p-4 md:p-6 transition-colors",
          question.isCorrect
            ? "border-[color:var(--tone-success)] bg-[color:var(--tone-success-surface)]"
            : "border-[color:var(--tone-danger)] bg-[color:var(--tone-danger-surface)]",
          isCollapsed && "max-h-96 overflow-hidden relative"
        )}
        aria-label={`Question ${index} - ${question.isCorrect ? "correct" : "incorrect"}`}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold">Question {index}</h3>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium",
              question.isCorrect
                ? "bg-[color:var(--tone-success-surface)] text-[color:var(--tone-success)]"
                : "bg-[color:var(--tone-danger-surface)] text-[color:var(--tone-danger)]"
            )}
          >
            {question.isCorrect ? "CORRECT" : "INCORRECT"}
          </span>
        </div>

        <p className="mb-4 text-foreground">{question.stem}</p>

        {question.options.length === 0 ? (
          <p className="italic text-muted-foreground">No options available</p>
        ) : (
          <div className="space-y-2">
            {question.options.map((option) => {
              const isUserAnswer = option.label === question.userAnswer;
              const isCorrectAnswer = option.label === question.correctAnswer;
              const showAsCorrect = isCorrectAnswer && !question.isCorrect;
              const showAsUserAnswer = isUserAnswer && !question.isCorrect;

              return (
                <div
                  key={option.label}
                  data-testid={`option-${option.label}`}
                  className={cn(
                    "p-3 rounded-lg border transition-all hover:shadow-sm break-words",
                    isCorrectAnswer && question.isCorrect && "border-[color:var(--tone-success)] bg-[color:var(--tone-success-surface)]",
                    showAsCorrect && "border-[color:var(--tone-success)] bg-[color:var(--tone-success-surface)]",
                    showAsUserAnswer && "border-2 border-[color:var(--tone-info)] bg-[color:var(--tone-info-surface)]",
                    !isUserAnswer && !isCorrectAnswer && "border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="font-medium text-muted-foreground">{option.label}.</span>
                    <span className="flex-1">{option.text}</span>
                    {isCorrectAnswer && question.isCorrect && (
                      <span className="text-xs font-medium text-[color:var(--tone-success)]">✓ Your answer</span>
                    )}
                    {showAsCorrect && (
                      <span className="text-xs font-medium text-[color:var(--tone-success)]">✓ Correct</span>
                    )}
                    {showAsUserAnswer && (
                      <span className="text-xs font-medium text-[color:var(--tone-info)]">Your answer</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {shouldShowExpandButton && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              onClick={() => toggleExpand(question.id)}
            >
              {isExpanded ? "Show less" : "Show more"}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg font-semibold">Question Details</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Object.entries(groupedQuestions).map(([domain, domainQuestions]) => (
          <div key={domain}>
            {groupByDomain && domain && (
              <h2
                data-testid={`domain-header-${domain}`}
                className="text-xl font-semibold mb-4 mt-6 first:mt-0"
              >
                {domain}
              </h2>
            )}
            {domainQuestions.map((question) => {
              // Calculate proper index for grouped questions
              const questionIndex = filteredQuestions.findIndex((q) => q.id === question.id);
              return renderQuestion(question, questionIndex + 1);
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
