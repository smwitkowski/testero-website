"use client";

import React from "react";
import { SettingsSidebar } from "@/components/dashboard/SettingsSidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height,56px))]">
      {/* Left Rail Navigation - Desktop */}
      <aside className="hidden lg:block lg:flex-shrink-0">
        <div
          className="fixed left-0 overflow-y-auto border-r"
          style={{
            top: "var(--topbar-height, 56px)",
            height: "calc(100vh - var(--topbar-height, 56px))",
            width: "var(--sidebar-width, 240px)",
          }}
        >
          <SettingsSidebar />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:ml-[var(--sidebar-width,240px)]">
        <div className="mx-auto px-4 py-8 lg:px-8" style={{ maxWidth: "var(--main-content-max-width, 1200px)" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
