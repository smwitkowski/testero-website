# Dark Mode Audit – Wave 2 Task 11

## 1. Title & Metadata
- **Project:** frontend
- **Branch:** work
- **Commit:** 077fee965862dd6cb32b1a1eaf8acce22f41ad9b
- **Date (UTC):** 2025-09-21 18:20:29
- **Node:** v22.19.0
- **Package Manager (npm):** 11.4.2

## 2. Executive Summary
Audited diagnostic and marketing surface components for hard-coded colors and non-semantic gradients. Legacy implementations relied on slate/orange hex literals, `bg-white` surfaces, and chart color functions tied to raw tokens. Replaced them with semantic CSS variables, added reusable tone mappings, and introduced gradient utilities so the same UI adapts to `class="dark"`. Verified that linting and type-checking pass and that ripgrep scans report no remaining hex/rgba usage in the audited scope. Remaining marketing page gradients outside this scope are called out for follow-up.

## 3. Methodology
- Static scanning with ripgrep: `#hex`, `rgba?(`, `bg-(white|black)`, `text-(white|black)`, `linear-gradient(`, bracketed color utilities. 【df70b1†L1-L11】【0defd4†L1-L94】
- Manual review of diagnostic UI for status indicators, progress bars, and recommendations.
- Updated token CSS to expose tone surfaces and gradients, then refactored components to consume `var(--tone-*)` or Tailwind token aliases.
- Verification commands: `npm run lint`, `npx tsc --noEmit`. 【e327e3†L1-L32】【2e402c†L1-L2】

## 4. Findings (Before)
| File | Line(s) | Pattern | Snippet |
| --- | --- | --- | --- |
| components/diagnostic/DomainBreakdown.tsx | 17-23 | Raw hex palette | `return "#22c55e";` and similar for amber/red status fills. 【df70b1†L1-L11】 |
| components/marketing/sections/final-cta-section.tsx | 15-24 | Hex strokes & green gradient badge | SVG strokes `stroke="#ED8936"` and `bg-gradient-to-r from-green-500`. 【df70b1†L7-L12】【0defd4†L73-L83】 |
| components/marketing/forms/waitlist-form.tsx | 132-188 | `bg-white`, red/green validation colors, gradient CTA | Template literal toggling `border-red-400 bg-red-50` and orange gradient buttons. 【0defd4†L1-L38】 |
| components/diagnostic/StudyRecommendations.tsx | 174-247 | Gray surfaces & hard-coded priority palettes | `bg-gray-50`, `bg-green-500`, and `border-red-200` priority badges. 【aab04c†L4-L12】 |

## 5. Changes Made
```diff
// styles/tokens.css (excerpt)
+  --tone-success: var(--chart-2);
+  --tone-warning: var(--chart-4);
+  --tone-danger: var(--chart-5);
+  --tone-info: var(--chart-3);
+  --tone-accent: var(--accent);
+  --tone-success-surface: color-mix(in oklch, var(--tone-success) 22%, transparent);
+  --tone-warning-surface: color-mix(in oklch, var(--tone-warning) 22%, transparent);
+  --tone-danger-surface: color-mix(in oklch, var(--tone-danger) 22%, transparent);
+  --tone-info-surface: color-mix(in oklch, var(--tone-info) 22%, transparent);
+  --tone-accent-surface: color-mix(in oklch, var(--tone-accent) 20%, transparent);
+  --tone-accent-border: color-mix(in oklch, var(--tone-accent) 32%, transparent);
+
+.ds-gradient-accent-surface { background-image: linear-gradient(...); }
+.ds-gradient-success-pill { background-image: linear-gradient(...); color: var(--foreground); }
```
```diff
// components/diagnostic/DomainBreakdown.tsx
+const toneBarFill: Record<Tone, string> = {
+  success: "var(--tone-success)",
+  warning: "var(--tone-warning)",
+  danger: "var(--tone-danger)",
+};
...
-          className={cn("p-4 rounded-lg bg-gray-50 ..." )}
+          className={cn(
+            "rounded-lg border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-4",
+            "hover:bg-[color:var(--surface-subtle)]",
+            onDomainClick && "cursor-pointer"
+          )}
```
```diff
// components/diagnostic/QuestionReview.tsx
-          className={cn("mb-4 p-6 rounded-lg border", ...)}
+          className={cn(
+            "mb-4 rounded-lg border p-6 transition-colors",
+            question.isCorrect
+              ? "border-[color:var(--tone-success)] bg-[color:var(--tone-success-surface)]"
+              : "border-[color:var(--tone-danger)] bg-[color:var(--tone-danger-surface)]",
+            isCollapsed && "max-h-96 overflow-hidden relative"
+          )}
...
-                    !isUserAnswer && !isCorrectAnswer && "bg-white border-gray-200"
+                    !isUserAnswer && !isCorrectAnswer && "border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)]"
```
```diff
// components/diagnostic/StudyRecommendations.tsx
-  color: "text-green-600",
+  tone: "success",
...
-        <div className="text-center p-6 rounded-lg bg-gray-50">
-          <h3 className={`text-2xl font-bold mb-2 ${performance.color}`}>{performance.title}</h3>
+        <div className="rounded-lg bg-[color:var(--surface-muted)] p-6 text-center">
+          <h3 className={cn("mb-2 text-2xl font-bold", performanceToneClass[performance.tone])}>{performance.title}</h3>
```
```diff
// components/diagnostic/UpsellModal.tsx
-    <div className="fixed inset-0 bg-black/50 ...">
+    <div className="fixed inset-0 z-50 flex ... bg-[color:color-mix(in oklch, var(--foreground) 72%, transparent)] ...">
...
-        className="... bg-white border border-slate-200 ..."
+        className="... border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] ..."
```
```diff
// components/marketing/forms/waitlist-form.tsx
-                          <Input className={`... border-red-400 bg-red-50 ...`}
+                          <Input
+                            className={cn(
+                              "min-h-[44px] w-full rounded-md border-2 px-3 py-2.5 text-base transition-all",
+                              "bg-[color:var(--surface-elevated)] text-foreground placeholder:text-muted-foreground/70",
+                              fieldState.error
+                                ? "border-[color:var(--tone-danger)] bg-[color:var(--tone-danger-surface)]"
+                                : ...
+                            )}
```
```diff
// components/marketing/sections/benefits-section.tsx
-const BenefitCard: React.FC<BenefitCardProps> = ({ highlightColor, bgColor, iconColor, ... })
+const BenefitCard: React.FC<BenefitCardProps> = ({ tone, ... })
...
-            className="bg-white p-4 sm:p-6 ... border border-slate-100"
+            className="rounded-xl border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-4 sm:p-6"
```
```diff
// components/marketing/sections/final-cta-section.tsx
-    <section className="w-full bg-gradient-to-br from-orange-50 via-orange-100 ...">
+    <section className="relative w-full ... ds-gradient-accent-surface">
...
-          <span className="bg-gradient-to-r from-green-500 to-green-600 text-white ...">
+          <span className="ds-gradient-success-pill inline-flex ...">
```
```diff
// components/marketing/sections/social-proof-section.tsx
-const SocialProofCard: React.FC<SocialProofCardProps> = ({ color, ... })
+const SocialProofCard: React.FC<SocialProofCardProps> = ({ tone, ... })
...
-        "bg-white p-4 sm:p-6 ... border border-slate-100"
+        'rounded-lg border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-4 sm:p-6'
```
```diff
// components/marketing/sections/testimonial-carousel.tsx
-            <figure className="... bg-white ... border border-slate-200 ...">
+            <figure className="... border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] ...">
```
```diff
// components/marketing/sections/trust-bar.tsx
-        "w-full py-8 px-4 sm:px-6 bg-white/50 ... border-slate-200/50"
+        "w-full border-y border-[color:var(--divider-color)] bg-[color:color-mix(in oklch, var(--surface-elevated) 70%, transparent)] ..."
```
```diff
// types/next-themes.d.ts
+declare module "next-themes" {
+  export interface ThemeProviderProps { ... }
+  export const ThemeProvider: React.ComponentType<ThemeProviderProps>;
+  export function useTheme(): {
+    theme: string | undefined;
+    setTheme: (theme: string) => void;
+    systemTheme: string | undefined;
+    resolvedTheme: string | undefined;
+  };
+}
```

## 6. Verification
- Post-refactor ripgrep scans report no hex usage in `components`/`app` scope. 【b88967†L1-L2】
- Remaining `rgba` usage limited to `app/pricing/page.tsx` (outside this task’s scope). 【6a28ce†L1-L4】
- ESLint (warnings only for section primitive guidance). 【e327e3†L1-L32】
- TypeScript clean after adding ambient `next-themes` declaration. 【2e402c†L1-L2】

## 7. Known Exceptions & TODOs
- `app/pricing/page.tsx` still contains a marketing gradient mask using `rgba()`; defer to broader marketing page theming initiative.
- Section primitive warnings flagged by lint remain unchanged; follow existing layout refactor plan.

## 8. Regression Checklist
- [x] Semantic tone variables drive all diagnostic charts and badges.
- [x] Marketing CTAs and testimonials use `var(--surface-*)` or tokenized gradients.
- [x] Validation, success, and danger states avoid color-only cues (iconography retained).
- [x] `npm run lint` and `npx tsc --noEmit` succeed.
- [x] Dark/light readability manually spot-checked on CTA, benefit cards, diagnostics.

## 9. Appendix
- Commands: `rg ...`, `npm run lint`, `npx tsc --noEmit && echo "tsc completed"`. 【df70b1†L1-L11】【e327e3†L1-L32】【2e402c†L1-L2】
- Added tone utilities and ambient module stub to support semantic usage of `next-themes`.
