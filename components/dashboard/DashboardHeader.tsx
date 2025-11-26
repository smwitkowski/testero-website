"use client";

import React from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

export interface DashboardHeaderProps {
  className?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ className }) => {
  const { user } = useAuth();
  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <div className={cn("mb-8", className)}>
      <h1 className="text-3xl font-bold mb-2 text-foreground">
        Welcome back, {userName}!
      </h1>
      <p className="text-muted-foreground">
        Let&apos;s continue your journey to PMLE certification.
      </p>
    </div>
  );
};

