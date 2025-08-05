"use client";

import React from 'react';
import { HoverButton } from "@/components/marketing/buttons/hover-button";

interface AuthSubmitButtonProps {
  isSubmitting: boolean;
  loadingText: string;
  submitText: string;
  type?: "submit" | "button";
}

export function AuthSubmitButton({ 
  isSubmitting, 
  loadingText, 
  submitText,
  type = "submit"
}: AuthSubmitButtonProps) {
  return (
    <HoverButton
      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-md text-base font-semibold shadow-md w-full transition-all"
      type={type}
      disabled={isSubmitting}
      aria-busy={isSubmitting ? "true" : "false"}
    >
      {isSubmitting ? (
        <div className="flex items-center justify-center">
          <svg 
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            ></circle>
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {loadingText}
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <span>{submitText}</span>
        </div>
      )}
    </HoverButton>
  );
}