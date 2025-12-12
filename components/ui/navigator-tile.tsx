"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavigatorTileProps {
  questionNumber: number;
  onClick: () => void;
  isAnswered?: boolean;
  isCurrent?: boolean;
  isFlagged?: boolean;
}

export const NavigatorTile = React.forwardRef<
  HTMLButtonElement,
  NavigatorTileProps
>(({ questionNumber, onClick, isAnswered = false, isCurrent = false, isFlagged = false }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition-colors",
        "hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        // Default state (unanswered)
        !isCurrent && !isAnswered && "border-slate-200 bg-white text-slate-700",
        // Answered state
        !isCurrent && isAnswered && "border-blue-200 bg-blue-50 text-blue-700",
        // Current state
        isCurrent && "border-blue-600 bg-blue-600 text-white"
      )}
      aria-label={`Question ${questionNumber}${isFlagged ? ", flagged" : ""}${isAnswered ? ", answered" : ""}`}
    >
      {questionNumber}
      {isFlagged && (
        <Flag
          data-testid="flag-icon"
          className="absolute -right-1 -top-1 h-3 w-3 text-amber-400"
          fill="currentColor"
          aria-hidden="true"
        />
      )}
    </button>
  );
});

NavigatorTile.displayName = "NavigatorTile";



