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
          <p className="text-gray-500">No questions to review</p>
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
          "mb-4 p-6 rounded-lg border",
          question.isCorrect ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50",
          isCollapsed && "max-h-96 overflow-hidden relative"
        )}
        aria-label={`Question ${index} - ${question.isCorrect ? "correct" : "incorrect"}`}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold">Question {index}</h3>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium text-white",
              question.isCorrect ? "bg-green-500" : "bg-red-500"
            )}
          >
            {question.isCorrect ? "CORRECT" : "INCORRECT"}
          </span>
        </div>

        <p className="mb-4 text-gray-700">{question.stem}</p>

        {question.options.length === 0 ? (
          <p className="text-gray-500 italic">No options available</p>
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
                    isCorrectAnswer && question.isCorrect && "bg-green-50 border-green-300",
                    showAsCorrect && "bg-green-50 border-green-300",
                    showAsUserAnswer && "border-blue-500 border-2",
                    !isUserAnswer && !isCorrectAnswer && "bg-white border-gray-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="font-medium text-gray-600">{option.label}.</span>
                    <span className="flex-1">{option.text}</span>
                    {isCorrectAnswer && question.isCorrect && (
                      <span className="text-xs text-green-600 font-medium">✓ Your answer</span>
                    )}
                    {showAsCorrect && (
                      <span className="text-xs text-green-600 font-medium">✓ Correct</span>
                    )}
                    {showAsUserAnswer && (
                      <span className="text-xs text-blue-600 font-medium">Your answer</span>
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
              size="sm"
              onClick={() => toggleExpand(question.id)}
              className="text-gray-600"
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
