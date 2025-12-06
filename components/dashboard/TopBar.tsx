"use client";

import React from "react";
import Link from "next/link";
import { UserDropdown } from "./UserDropdown";
import { Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorComponent } from "@/lib/design-system";
import { TesteroIcon } from "@/components/brand";

export interface TopBarProps {
  onMenuToggle?: () => void;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, className }) => {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b px-4",
        className
      )}
      style={{
        height: "var(--topbar-height, 56px)",
        backgroundColor: colorComponent.dashboard.topBar.background,
        borderColor: colorComponent.dashboard.topBar.border,
      }}
    >
      {/* Left side: Logo + Hamburger (mobile) */}
      <div className="flex items-center gap-4">
        {/* Hamburger menu for mobile */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
          aria-label="Toggle menu"
          aria-expanded="false"
        >
          <Menu className="h-6 w-6 text-foreground" />
        </button>

        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
          aria-label="Testero Dashboard"
        >
          <TesteroIcon size={32} />
          <span className="text-xl font-bold text-foreground hidden sm:inline">Testero</span>
        </Link>
      </div>

      {/* Right side: Notifications + User dropdown */}
      <div className="flex items-center gap-4">
        {/* Notification bell - placeholder */}
        <button
          className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm p-1"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* User dropdown */}
        <UserDropdown />
      </div>
    </header>
  );
};

