"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface EditorHeaderProps {
  questionId: string;
  questionStem: string;
  hasUnsavedChanges?: boolean;
}

export function EditorHeader({
  questionId,
  questionStem,
  hasUnsavedChanges = false,
}: EditorHeaderProps) {
  const truncatedStem = questionStem.length > 80
    ? `${questionStem.slice(0, 80)}...`
    : questionStem;

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border/60 bg-white/95 p-4 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/admin/questions"
            className="hover:text-foreground transition-colors"
          >
            Admin
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            href="/admin/questions"
            className="hover:text-foreground transition-colors"
          >
            Question Review
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">PMLE</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Q-{questionId.slice(0, 8)}</span>
        </nav>
        <div className="ml-4 flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-lg font-semibold text-foreground">
            {truncatedStem}
          </h1>
          {hasUnsavedChanges && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}
