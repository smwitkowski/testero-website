"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, CreditCard, Shield, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorComponent } from "@/lib/design-system";

export interface SettingsSidebarProps {
  className?: string;
}

const settingsNavItems = [
  { id: "overview", label: "Overview", href: "/dashboard/settings", icon: SettingsIcon },
  { id: "account", label: "Account", href: "/dashboard/settings/account", icon: User },
  { id: "billing", label: "Billing", href: "/dashboard/settings/billing", icon: CreditCard },
  { id: "privacy", label: "Privacy", href: "/dashboard/settings/privacy", icon: Shield },
] as const;

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ className }) => {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white border-r border-border/60",
        className
      )}
      style={{ width: "var(--sidebar-width, 240px)" }}
    >
      {/* Settings Header */}
      <div
        className="p-4 border-b border-border/60"
        style={{
          backgroundColor: colorComponent.dashboard.examContext.background,
          borderColor: colorComponent.dashboard.examContext.border,
        }}
      >
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium uppercase tracking-wide" style={{ color: colorComponent.dashboard.examContext.label }}>
            Settings
          </div>
          <div className="text-sm font-semibold" style={{ color: colorComponent.dashboard.examContext.text }}>
            Manage your account
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" aria-label="Settings navigation">
        {settingsNavItems.map((item) => {
          const Icon = item.icon;
          // Match exact path for overview, or check if pathname starts with item href for subroutes
          const isActive =
            item.id === "overview"
              ? pathname === "/dashboard/settings"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
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
    </aside>
  );
};
