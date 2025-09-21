# Global Dark Mode Setup

## 1. Overview
- Install [`next-themes`](https://github.com/pacocoursey/next-themes) to control the theme token system from the application shell.
- Wrap the entire App Router tree in a `<ThemeProvider>` so the `dark` class is toggled on `<html>` and existing CSS variables in `app/globals.css` power light/dark palettes.
- Provide an accessible `<ThemeToggle />` so users can switch themes anywhere, plus an automated Playwright smoke test to guard the behavior.

## 2. Install Steps & Commands
```bash
# install the theme controller
npm install next-themes

# re-run linting after code edits
npm run lint

# optional: run the dark-mode Playwright check (set Supabase env vars if needed)
NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="public-anon-key" \
npx playwright test e2e/theme-toggle.spec.ts --project=chromium
```

## 3. Tailwind & Token Prerequisites Checklist
- [x] `tailwind.config.ts` uses `darkMode: ["class"]` so `next-themes` can flip the class on `<html>`.
- [x] `app/globals.css` already exposes token pairs (example below) that update automatically when `.dark` is present.

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* … */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* … */
}
```

## 4. File-by-File Changes (unified diffs)
```diff
--- a/package.json
+++ b/package.json
@@
-    "next-mdx-remote": "^5.0.0",
+    "next-mdx-remote": "^5.0.0",
+    "next-themes": "^0.4.6",
```
```diff
--- a/package-lock.json
+++ b/package-lock.json
@@
-        "next-mdx-remote": "^5.0.0",
+        "next-mdx-remote": "^5.0.0",
+        "next-themes": "^0.4.6",
@@
+    "node_modules/next-themes": {
+      "version": "0.4.6",
+      "resolved": "https://registry.npmjs.org/next-themes/-/next-themes-0.4.6.tgz",
+      "integrity": "sha512-pZvgD5L0IEvX5/9GWyHMf3m8BKiVQwsCMHfoFosXtXBMnaS0ZnIJ9ST4b4NqLVKDEm8QBxoNNGNaBv2JNF6XNA==",
+      "license": "MIT"
+    },
```
```diff
--- a/tailwind.config.ts
+++ b/tailwind.config.ts
@@
-const config = {
-  darkMode: "class",
+const config = {
+  darkMode: ["class"],
```
```diff
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@
-import { SessionTrackingProvider } from "@/components/providers/SessionTrackingProvider";
+import { SessionTrackingProvider } from "@/components/providers/SessionTrackingProvider";
+import { Providers } from "@/components/providers/Providers";
@@
-    <html lang="en">
+    <html lang="en" suppressHydrationWarning>
@@
-      <body className="antialiased font-sans" suppressHydrationWarning>
-        {/* Skip to content link for accessibility */}
-        <a
-          href="#main-content"
-          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black focus:outline-none"
-        >
-          Skip to content
-        </a>
-        <ErrorBoundary>
-          <AuthProvider>
-            <Navbar />
-            <main id="main-content" className="pt-[72px]">
-              <PostHogProvider>
-                <SessionTrackingProvider>{children}</SessionTrackingProvider>
-              </PostHogProvider>
-            </main>
-          </AuthProvider>
-        </ErrorBoundary>
+      <body className="bg-background text-foreground antialiased font-sans">
+        <Providers>
+          {/* Skip to content link for accessibility */}
+          <a
+            href="#main-content"
+            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black focus:outline-none"
+          >
+            Skip to content
+          </a>
+          <ErrorBoundary>
+            <AuthProvider>
+              <Navbar />
+              <main id="main-content" className="pt-[72px]">
+                <PostHogProvider>
+                  <SessionTrackingProvider>{children}</SessionTrackingProvider>
+                </PostHogProvider>
+              </main>
+            </AuthProvider>
+          </ErrorBoundary>
+        </Providers>
       </body>
     </html>
```
```diff
--- a/components/marketing/navigation/navbar.tsx
+++ b/components/marketing/navigation/navbar.tsx
@@
-import { colorPrimitive, typographyPrimitive } from '@/lib/design-system';
-import { useAuth } from '@/components/providers/AuthProvider';
+import { useAuth } from '@/components/providers/AuthProvider';
+import { ThemeToggle } from '@/components/ui/theme-toggle';
@@
-    <header
-      className={`fixed top-0 left-0 right-0 z-50 h-[72px] bg-white md:bg-white/80 md:backdrop-blur-md ${
-        isScrolled ? 'shadow-sm border-b border-ui-border-light' : ''
-      }`}
-      style={{ borderColor: colorPrimitive.slate[200] }}
-    >
+    <header
+      className={`fixed top-0 left-0 right-0 z-50 h-[72px] bg-background md:bg-background/80 md:backdrop-blur-md transition-colors ${
+        isScrolled ? 'shadow-sm border-b border-border/60' : 'border-b border-transparent'
+      }`}
+    >
@@
-          <Link href="/" aria-label="Testero Home">
-            <span className="text-xl font-bold" style={{ color: colorPrimitive.slate[800] }}>Testero</span>
-          </Link>
+          <Link href="/" aria-label="Testero Home">
+            <span className="text-xl font-bold text-foreground transition-colors">Testero</span>
+          </Link>
@@
-          <button
-            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
-            className="text-ui-text-primary focus:outline-none focus:ring-2 focus:ring-accent-500"
-            style={{ color: colorPrimitive.slate[800] }}
+          <button
+            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
+            className="text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
@@
-        <nav className="hidden md:flex space-x-6 flex-grow justify-center" aria-label="Primary navigation">
+        <nav className="hidden md:flex space-x-6 flex-grow justify-center" aria-label="Primary navigation">
           {navigationItems.map((item) => (
             <Link
               key={item.name}
               href={item.href}
-              className={`relative ${pathname === item.href ? 'text-accent-500' : 'text-primary-800'} hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500`}
-              style={{ fontSize: typographyPrimitive.fontSize.base }}
+              className={`relative text-sm font-medium transition-colors duration-200 ${
+                pathname === item.href ? 'text-foreground' : 'text-muted-foreground'
+              } hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
@@
-        <div className="hidden md:flex items-center space-x-4 flex-shrink-0 ml-auto">
+        <div className="hidden md:flex items-center space-x-4 flex-shrink-0 ml-auto">
+          <ThemeToggle />
           {session ? (
             <>
-              <Link
-                href="/dashboard"
-                className="text-ui-text-primary hover:text-accent-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
-                style={{ color: colorPrimitive.slate[800], fontSize: typographyPrimitive.fontSize.base }}
-              >
+              <Link
+                href="/dashboard"
+                className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
+              >
@@
-        <div id="mobile-menu" className="md:hidden fixed inset-0 top-[72px] bg-white shadow-md transition-transform transform ease-in-out duration-300 translate-x-0">
+        <div id="mobile-menu" className="md:hidden fixed inset-0 top-[72px] bg-background text-foreground shadow-md transition-transform transform ease-in-out duration-300 translate-x-0">
@@
-            <div className="flex flex-col space-y-4 mt-4 pt-4 border-t border-ui-border-light" style={{ borderColor: colorPrimitive.slate[200] }}>
+            <div className="flex flex-col space-y-4 mt-4 pt-4 border-t border-border/60">
+              <ThemeToggle />
```

## 5. New Files (full source)
```tsx
// components/providers/Providers.tsx
"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="ui-theme"
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
```
```tsx
// components/ui/theme-toggle.tsx
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

  const icon = !isMounted ? (
    <Monitor className="h-5 w-5" aria-hidden="true" />
  ) : currentTheme === "dark" ? (
    <MoonStar className="h-5 w-5" aria-hidden="true" />
  ) : (
    <SunMedium className="h-5 w-5" aria-hidden="true" />
  );

  const isDark = isMounted ? currentTheme === "dark" : false;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isDark}
      title={`${LABEL} (current: ${currentTheme ?? "system"})`}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-transparent text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="sr-only">{LABEL}</span>
      {icon}
    </button>
  );
}
```
```ts
// e2e/theme-toggle.spec.ts
import { expect, test } from "@playwright/test";

const TOGGLE_NAME = /toggle dark mode/i;

async function getHtmlHasDark(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

test("theme toggle switches between light and dark themes", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("ui-theme");
  });
  await page.goto("/");

  const initialPrefersDark = await page.evaluate(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const initialHasDark = await getHtmlHasDark(page);

  if (initialPrefersDark) {
    expect(initialHasDark).toBe(true);
  }

  const toggle = page.getByRole("button", { name: TOGGLE_NAME });

  await toggle.click();

  const afterFirstToggle = await getHtmlHasDark(page);
  expect(afterFirstToggle).not.toBe(initialHasDark);

  await toggle.click();

  const afterSecondToggle = await getHtmlHasDark(page);
  expect(afterSecondToggle).toBe(initialHasDark);
});
```

## 6. Minimal Usage Example
```tsx
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function HeaderActions() {
  return (
    <div className="flex items-center gap-4">
      {/* other actions */}
      <ThemeToggle />
    </div>
  );
}
```

## 7. Manual Validation Checklist
1. Load `/` in a browser, ensure the shell inherits `bg-background text-foreground` and the toggle renders in the navigation.
2. Click the toggle twice; confirm the page background, typography, and token-driven surfaces switch between light and dark (inspect `<html>` to verify the `dark` class is set/removed).
3. In DevTools, manually toggle the `.dark` class on `<html>` to verify downstream tokens (`--background`, `--foreground`, cards, buttons) respond.
4. Visit additional routes (e.g., `/blog`, `/dashboard`) to confirm contrast remains acceptable.
5. Optional: to minimize the initial flash, pre-render pages or add a `prefers-color-scheme` media query in the `<head>` as a follow-up if necessary.

## 8. Automated Test & CI Note
- Test file: `e2e/theme-toggle.spec.ts`.
- Local run:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="public-anon-key" \
  npx playwright test e2e/theme-toggle.spec.ts --project=chromium
  ```
  (Set the Supabase URL/key env vars so the dev server boots without runtime errors.)
- CI recommendation: extend the existing Playwright workflow to run the command above (or add a targeted job) after seeding required environment variables.

## 9. Rollback Instructions
1. `npm uninstall next-themes`.
2. Delete `components/providers/Providers.tsx`, `components/ui/theme-toggle.tsx`, and `e2e/theme-toggle.spec.ts`.
3. Remove `<Providers>` from `app/layout.tsx` and revert theme-related class names.
4. Delete the `<ThemeToggle />` usages from navigation and any other placements.
5. Restore `darkMode` in `tailwind.config.ts` if it must return to the previous configuration.
