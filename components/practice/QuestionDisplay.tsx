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
          
          // Show explanation if feedback exists and this is the selected or correct option
          const shouldShowExplanation = feedback && (isSelected || isCorrect);
          const explanation = shouldShowExplanation 
            ? feedback.explanationsByOptionKey[option.label] 
            : null;
          
          return (
            <div key={option.id} className="flex flex-col gap-2">
              <button
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
              {explanation && (
                <div className={`
                  ml-4 p-3 rounded-md text-sm border-l-4
                  ${isCorrect 
                    ? 'bg-green-50 text-green-800 border-green-400' 
                    : isIncorrect 
                    ? 'bg-red-50 text-red-800 border-red-400'
                    : 'bg-gray-50 text-gray-700 border-gray-400'
                  }
                `}>
                  <div className="font-semibold mb-1">
                    {isCorrect ? 'Correct answer explanation:' : 'Explanation:'}
                  </div>
                  <div>{explanation}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};