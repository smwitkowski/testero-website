declare module "next-themes" {
  import * as React from "react";

  export interface ThemeProviderProps {
    children: React.ReactNode;
    attribute?: string;
    defaultTheme?: string;
    enableSystem?: boolean;
    storageKey?: string;
    disableTransitionOnChange?: boolean;
  }

  export const ThemeProvider: React.ComponentType<ThemeProviderProps>;

  export function useTheme(): {
    theme: string | undefined;
    setTheme: (theme: string) => void;
    systemTheme: string | undefined;
    resolvedTheme: string | undefined;
  };
}
