"use client";

import * as React from "react";
import { Monitor, MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

const LABEL = "Toggle dark mode";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentTheme = theme === "system" ? resolvedTheme : theme;

  function getNextTheme() {
    if (!isMounted) {
      return "system";
    }

    if (theme === "system") {
      return resolvedTheme === "dark" ? "light" : "dark";
    }

    return currentTheme === "dark" ? "light" : "dark";
  }

  function handleToggle() {
    const next = getNextTheme();
    setTheme(next ?? "system");
  }

  const icon = !isMounted
    ? <Monitor className="h-5 w-5" aria-hidden="true" />
    : currentTheme === "dark"
      ? <MoonStar className="h-5 w-5" aria-hidden="true" />
      : <SunMedium className="h-5 w-5" aria-hidden="true" />;

  const isDark = isMounted ? currentTheme === "dark" : false;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isDark}
      title={`${LABEL} (current: ${currentTheme ?? "system"})`}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-transparent text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="sr-only">{LABEL}</span>
      {icon}
    </button>
  );
}
