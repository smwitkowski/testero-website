"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export interface TestHeaderProps {
  examName: string;
  testType: string;
  progressPercent?: number;
  onExit: () => void;
}

export const TestHeader: React.FC<TestHeaderProps> = ({
  examName,
  testType,
  progressPercent = 0,
  onExit,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">
            {examName} · {testType}
          </h1>
          <Button
            variant="ghost"
            tone="neutral"
            size="md"
            onClick={onExit}
            icon={<X className="h-4 w-4" />}
          >
            Exit test
          </Button>
        </div>
      </div>
      {progressPercent !== undefined && (
        <div className="h-1 bg-slate-100">
          <Progress value={progressPercent} className="h-1" />
        </div>
      )}
    </header>
  );
};



