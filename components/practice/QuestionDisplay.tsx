"use client";
import React from "react";
import { QuestionData, QuestionFeedback } from "./types";

interface QuestionDisplayProps {
  question: QuestionData;
  selectedOptionKey: string | null;
  feedback: QuestionFeedback | null;
  onOptionSelect: (optionKey: string) => void;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  selectedOptionKey,
  feedback,
  onOptionSelect,
}) => {
  return (
    <>
      <div className="text-xl font-medium mb-6">
        {question.question_text}
      </div>
      <div className="flex flex-col gap-3 mb-8 max-w-[90%] mx-auto">
        {question.options.map((option) => {
          const isSelected = selectedOptionKey === option.label;
          const isCorrect = feedback?.correctOptionKey === option.label;
          const isIncorrect = feedback && isSelected && !feedback.isCorrect;
          const isDisabled = !!feedback;
          
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !isDisabled && onOptionSelect(option.label)}
              disabled={isDisabled}
              className={`
                p-3 rounded-md text-left transition-all duration-150 w-full
                ${isSelected ? 'border-2 border-blue-500' : 'border border-gray-300'}
                ${isCorrect 
                  ? 'bg-green-100 text-green-700 border-green-500' 
                  : isIncorrect 
                  ? 'bg-red-100 text-red-700 border-red-500'
                  : isSelected 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                }
                ${isSelected ? 'font-semibold' : 'font-normal'}
                ${isDisabled && !isSelected && !isCorrect ? 'opacity-70' : 'opacity-100'}
                ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {option.text}
              {isCorrect && feedback && (
                <span className="ml-2 font-bold">✓</span>
              )}
              {isIncorrect && feedback && (
                <span className="ml-2 font-bold">✗</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};