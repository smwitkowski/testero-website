"use client";

import React from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DashboardHeaderProps {
  onStartPractice?: () => void;
  onReviewWeakest?: () => void;
  className?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onStartPractice,
  onReviewWeakest,
  className,
}) => {
  const { user } = useAuth();
  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <div className={cn("mb-8", className)}>
      <h1 className="text-3xl font-bold mb-2 text-foreground">
        Welcome back, {userName}!
      </h1>
      <p className="text-muted-foreground mb-6">
        Let&apos;s continue your journey to PMLE certification.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={onStartPractice}
          tone="accent"
          size="lg"
          className="sm:w-auto"
        >
          Start New Practice Exam
        </Button>
        <Button
          onClick={onReviewWeakest}
          variant="outline"
          size="lg"
          className="sm:w-auto"
        >
          Review Weakest Areas
        </Button>
      </div>
    </div>
  );
};

