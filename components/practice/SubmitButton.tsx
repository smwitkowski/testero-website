"use client";
import React from "react";

interface SubmitButtonProps {
  onSubmit: () => void;
  disabled: boolean;
  submitting: boolean;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  onSubmit,
  disabled,
  submitting,
}) => {
  return (
    <button
      onClick={onSubmit}
      disabled={disabled}
      className={`
        px-8 py-3 rounded-md font-semibold text-white transition-colors
        ${disabled 
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
        }
      `}
    >
      {submitting ? "Submitting..." : "Submit"}
    </button>
  );
};