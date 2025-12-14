"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, HelpCircle, Calendar, Shield, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorComponent } from "@/lib/design-system";
import { useAdminStatus } from "@/hooks/useAdminStatus";

export interface DashboardSidebarProps {
  activeItem?: "dashboard" | "practice" | "study-plan" | "performance" | "admin";
  showUpgradeCTA?: boolean;
  onNavigate?: (item: string) => void;
  onUpgrade?: () => void;
  className?: string;
}

const navigationItems = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home },
  { id: "practice", label: "Practice Exams", href: "/practice/question", icon: HelpCircle },
  { id: "performance", label: "Performance", href: "/dashboard/performance", icon: BarChart3 },
  { id: "study-plan", label: "Study Plan", href: "/study-path", icon: Calendar },
] as const;

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeItem = "dashboard",
  showUpgradeCTA = false,
  onNavigate,
  onUpgrade,
  className,
}) => {
  const { isAdmin } = useAdminStatus();

  // Build navigation items, including admin link if user is admin
  const allNavigationItems = [
    ...navigationItems,
    ...(isAdmin
      ? [{ id: "admin" as const, label: "Admin", href: "/admin/questions", icon: Shield }]
      : []),
  ];

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white border-r border-border/60",
        className
      )}
      style={{ width: "var(--sidebar-width, 240px)" }}
    >
      {/* Exam Context Switcher */}
      <div
        className="p-4 border-b border-border/60"
        style={{
          backgroundColor: colorComponent.dashboard.examContext.background,
          borderColor: colorComponent.dashboard.examContext.border,
        }}
      >
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium uppercase tracking-wide" style={{ color: colorComponent.dashboard.examContext.label }}>
            Studying for
          </div>
          <div className="text-sm font-semibold" style={{ color: colorComponent.dashboard.examContext.text }}>
            PMLE
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" aria-label="Dashboard navigation">
        {allNavigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => onNavigate?.(item.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
              style={
                isActive
                  ? {
                      backgroundColor: colorComponent.dashboard.sidebar.activeItemBg,
                      color: colorComponent.dashboard.sidebar.activeItem,
                    }
                  : undefined
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Upgrade CTA */}
      {showUpgradeCTA && (
        <div className="p-4 border-t border-border/60">
          <Button
            onClick={onUpgrade}
            tone="accent"
            className="w-full"
            size="sm"
          >
            Upgrade to PMLE Readiness
          </Button>
        </div>
      )}
    </aside>
  );
};

