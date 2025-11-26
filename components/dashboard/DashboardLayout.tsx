"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  rightPanel?: React.ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  sidebar,
  main,
  rightPanel,
  className,
}) => {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 h-screen">
        {/* Sidebar - fixed width on desktop */}
        <div className="lg:col-span-3 xl:col-span-2 hidden lg:block">
          {sidebar}
        </div>

        {/* Main content area */}
        <div className="lg:col-span-9 xl:col-span-7 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            {main}
          </div>
        </div>

        {/* Right panel - optional */}
        {rightPanel && (
          <div className="lg:col-span-3 xl:col-span-3 hidden lg:block overflow-y-auto border-l border-border/60">
            <div className="p-6 space-y-6">
              {rightPanel}
            </div>
          </div>
        )}
      </div>

      {/* Mobile sidebar overlay */}
      <div className="lg:hidden">
        {sidebar}
      </div>
    </div>
  );
};

