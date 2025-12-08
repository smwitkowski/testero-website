"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  sidebar,
  main,
  className,
}) => {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="flex h-screen">
        {/* Sidebar - fixed width on desktop */}
        <div className="hidden lg:block lg:flex-shrink-0" style={{ width: "var(--sidebar-width, 240px)" }}>
          {sidebar}
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto px-4 py-8 lg:px-8" style={{ maxWidth: "var(--main-content-max-width, 1920px)" }}>
            {main}
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      <div className="lg:hidden">
        {sidebar}
      </div>
    </div>
  );
};

