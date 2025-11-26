"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Home, HelpCircle, BarChart3, Calendar, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorComponent } from "@/lib/design-system";

export interface DashboardSidebarProps {
  activeItem?: "dashboard" | "practice" | "performance" | "study-plan" | "settings";
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
  { id: "settings", label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeItem = "dashboard",
  showUpgradeCTA = false,
  onNavigate,
  onUpgrade,
  className,
}) => {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white border-r border-border/60",
        className
      )}
      style={{ width: "var(--sidebar-width, 260px)" }}
    >
      {/* Logo */}
      <div className="p-6 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">T</span>
          </div>
          <span className="text-xl font-bold text-foreground">Testero</span>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground font-semibold text-sm">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{userName}</div>
            <div className="text-xs text-muted-foreground">Studying for PMLE</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" aria-label="Dashboard navigation">
        {navigationItems.map((item) => {
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
            Upgrade Plan
          </Button>
        </div>
      )}
    </aside>
  );
};

