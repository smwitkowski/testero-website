"use client";
import React from "react";
import { QuestionFeedback as FeedbackType } from "./types";

interface QuestionFeedbackProps {
  feedback: FeedbackType;
  onNextAction: () => void;
  nextActionLabel?: string;
}

export const QuestionFeedback: React.FC<QuestionFeedbackProps> = ({
  feedback,
  onNextAction,
  nextActionLabel = "Next Question",
}) => {
  return (
    <div className="mt-8">
      <div className={`
        text-lg font-semibold mb-3
        ${feedback.isCorrect ? 'text-green-600' : 'text-red-600'}
      `}>
        {feedback.isCorrect ? "Correct!" : "Incorrect."}
      </div>
      <button
        onClick={onNextAction}
        className="mt-4 px-7 py-2.5 rounded-md bg-gray-100 text-gray-800 border border-gray-300 font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
      >
        {nextActionLabel}
      </button>
    </div>
  );
};