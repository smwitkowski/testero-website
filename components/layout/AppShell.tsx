"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/dashboard/TopBar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { cn } from "@/lib/utils";
import { colorComponent } from "@/lib/design-system";
import { X } from "lucide-react";

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

// Map pathname to active sidebar item
const getActiveItem = (pathname: string): "dashboard" | "practice" | "performance" | "study-plan" => {
  if (pathname.startsWith("/dashboard")) {
    return "dashboard";
  }
  if (pathname.startsWith("/practice")) {
    return "practice";
  }
  if (pathname.startsWith("/dashboard/performance")) {
    return "performance";
  }
  if (pathname.startsWith("/study-path")) {
    return "study-plan";
  }
  return "dashboard";
};

export const AppShell: React.FC<AppShellProps> = ({ children, className }) => {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeItem = getActiveItem(pathname);

  const handleMenuToggle = () => {
    setSidebarOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* TopBar - fixed at top */}
      <TopBar onMenuToggle={handleMenuToggle} />

      <div className="flex pt-[56px]">
        {/* Desktop Sidebar - always visible on lg+ */}
        <aside className="hidden lg:block lg:w-[240px] lg:flex-shrink-0">
          <div
            className="fixed left-0 top-[56px] h-[calc(100vh-56px)] overflow-y-auto border-r"
            style={{
              width: "240px",
              backgroundColor: colorComponent.dashboard.sidebar.background,
              borderColor: colorComponent.dashboard.sidebar.hoverBg,
            }}
          >
            <DashboardSidebar activeItem={activeItem} />
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 lg:hidden"
              style={{
                backgroundColor: colorComponent.dashboard.sidebarOverlay.backdrop,
              }}
              onClick={handleCloseSidebar}
              aria-hidden="true"
            />
            {/* Sidebar */}
            <aside
              className="fixed left-0 top-[56px] z-50 h-[calc(100vh-56px)] w-[280px] overflow-y-auto border-r lg:hidden"
              style={{
                backgroundColor: colorComponent.dashboard.sidebar.background,
                borderColor: colorComponent.dashboard.sidebar.hoverBg,
              }}
            >
              <div className="relative">
                {/* Close button */}
                <button
                  onClick={handleCloseSidebar}
                  className="absolute right-4 top-4 rounded-sm p-1 focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Close sidebar"
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
                <DashboardSidebar activeItem={activeItem} />
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

