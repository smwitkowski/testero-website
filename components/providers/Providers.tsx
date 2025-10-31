"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey="ui-theme"
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
