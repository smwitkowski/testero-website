# Design Consistency Audit

## 1. Title & Metadata
- **Project**: frontend【F:package.json†L1-L76】
- **Commit**: 0ffe0c2b4b41611263e2e7305bd2d08646fa6a31【772abd†L1-L2】
- **Date**: 2025-09-20T20:34:30+00:00【620bf8†L1-L2】
- **Auditor**: Codex
- **Node**: v22.19.0【8003c6†L1-L3】
- **npm**: 11.4.2【8f0a31†L1-L3】
- **pnpm**: 10.13.1【6be7c6†L1-L2】

## 2. Executive Summary
Overall score: **37 / 100**. The token library is comprehensive, yet several flagship experiences bypass it via hard-coded gradients and hex values, so theme and dark-mode integrity break on critical screens.【F:components/diagnostic/ScoreChart.tsx†L12-L124】【F:components/marketing/sections/enhanced-social-proof.tsx†L16-L146】 Primary actions rely on a CVA wrapper that drops visible focus states and omits semantic defaults, exposing accessibility regressions and encouraging bespoke button clones.【F:components/ui/button.tsx†L11-L65】【9275bd†L1-L2】 There is no Storybook/Ladle or design-system route, leaving the team without a living spec or regression surface.【da6a9e†L1-L3】【310bbb†L1-L2】【F:app/design-system/page.tsx†L1-L7】 

**Top risks (P1)**
1. Hex-coded diagnostic and marketing surfaces ignore semantic tokens, so dark mode and rebrands cannot ship safely.【F:components/diagnostic/ScoreChart.tsx†L12-L124】【F:components/marketing/sections/enhanced-social-proof.tsx†L16-L146】
2. Core `Button` variant lacks token integration and focus contrast, leading to inconsistent motion/spacing and WCAG violations when reused.【F:components/ui/button.tsx†L11-L65】【9275bd†L1-L2】
3. Absence of Storybook/Ladle or design-system docs removes guardrails for component APIs and visual regression catching.【da6a9e†L1-L3】【310bbb†L1-L2】【F:app/design-system/page.tsx†L1-L7】

**Fast wins**
- Refactor shared container spacing and cards to consume spacing tokens / utilities instead of repeated `max-w-7xl` strings.【F:components/ui/card.tsx†L8-L37】【264095†L1-L8】
- Mount a theme provider (e.g. `next-themes`) that toggles the `dark` class so CSS variables in `globals.css` take effect across layouts.【F:app/layout.tsx†L32-L48】【F:app/globals.css†L45-L122】
- Give CTA buttons an explicit `type`, focus styles, and semantic colors pulled from the design-system export to stop divergence.【F:components/pricing/PricingCard.tsx†L205-L241】【F:lib/design-system/components.ts†L10-L74】

## 3. Scorecard
| Dimension | Score | Notes |
| --- | --- | --- |
| Tokens & Theme mapping | 6 / 15 | Tokens exist in `tailwind.config.ts`, but key UIs fall back to raw hex values and inline gradients, bypassing semantic aliases.【F:tailwind.config.ts†L1-L200】【F:components/marketing/sections/enhanced-social-proof.tsx†L16-L146】 |
| Component Variants | 5 / 15 | CVA wrappers (`Button`, `Card`) ignore exported design-system variants and recreate sizes/variants with utility strings; gradients use bespoke components.【F:components/ui/button.tsx†L11-L65】【F:components/ui/gradient-button.tsx†L35-L143】【F:lib/design-system/components.ts†L10-L108】 |
| Layout/Spacing discipline | 6 / 10 | Consistent breakpoints exist, but pages hard-code `max-w-7xl`/padding combos instead of a shared layout primitive, and cards hand-pick gaps.【F:components/ui/card.tsx†L8-L54】【F:app/pricing/page.tsx†L124-L214】【264095†L1-L8】 |
| Theming/Dark mode integrity | 4 / 10 | CSS variables define light/dark palettes, yet the root layout never toggles `.dark`, and several components use fixed colors, so dark mode coverage is partial.【F:app/globals.css†L45-L122】【F:app/layout.tsx†L32-L48】【F:components/diagnostic/ScoreChart.tsx†L12-L124】 |
| Accessibility | 6 / 10 | Skip link and form primitives exist, but buttons remove focus outlines and marketing CTAs omit `type` and rely on color-only status cues.【F:components/ui/button.tsx†L11-L65】【9275bd†L1-L2】【F:components/pricing/PricingCard.tsx†L205-L241】【F:components/diagnostic/ScoreChart.tsx†L12-L124】 |
| Storybook/Ladle coverage | 0 / 10 | No `.storybook` directory, no stories files, and `/app/design-system` redirects home, so there is no component gallery or documentation.【da6a9e†L1-L3】【310bbb†L1-L2】【F:app/design-system/page.tsx†L1-L7】 |
| CI Guardrails | 6 / 10 | Cloud Run workflow runs lint + typecheck, but design linting, visual tests, and unit/e2e suites are skipped on PRs.【38a84e†L1-L86】【F:package.json†L5-L30】 |
| Pattern Reuse | 4 / 10 | Feature modules rebuild cards/buttons with local token maps (e.g. `TrustedBySection`) and bypass design-system exports, fragmenting patterns.【F:components/sections/TrustedBySection.tsx†L10-L118】【F:components/pricing/PricingCard.tsx†L205-L264】【F:lib/design-system/components.ts†L10-L108】 |

## 4. Evidence & Analysis
### 4.1 Tokens & Tailwind Theme
- ✓ **Expectation**: Tailwind theme consumes primitive/semantic tokens so components never reference raw hex/gradients.
- ✗ **What we found**: While the theme imports tokens, UI code frequently inlines brand hex values and styles state with manual gradients (e.g. ScoreChart, SocialProof badges), defeating semantic color layers and dark-mode overrides.【F:tailwind.config.ts†L1-L200】【F:components/diagnostic/ScoreChart.tsx†L12-L124】【F:components/marketing/sections/enhanced-social-proof.tsx†L16-L146】 Command scan confirms many hex hits across TSX files.【473e7f†L1-L28】 
- 🔧 **Recommendations**: Map semantic tokens to Tailwind utilities (e.g. `text-success`, `bg-surface-elevated`) and refactor charts/marketing components to use `colorSemantic` references or theme classes instead of inline styles.

```tsx
// components/diagnostic/ScoreChart.tsx:L12-L121
function getScoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}
...
<span className={cn(config.fontSize, "font-bold")} style={{ color }}>
  {displayScore}%
</span>
```

### 4.2 Component API & Variants
- ✓ **Expectation**: Components expose typed variant APIs backed by shared design-system configs.
- ✗ **What we found**: `Button` CVA variants hard-code Tailwind classes (including `hover:scale-105`) and drop default `type`, while the exported `buttonVariants` in `lib/design-system/components.ts` remain unused. A separate `GradientButton` duplicates button logic with another bespoke variant map.【F:components/ui/button.tsx†L11-L65】【F:lib/design-system/components.ts†L10-L74】【F:components/ui/gradient-button.tsx†L35-L143】 
- 🔧 **Recommendations**: Generate Tailwind class maps directly from `lib/design-system/components` (or migrate to `tailwind-variants`) and enforce usage via lint rule / codemod. Provide default `type="button"` and align `GradientButton` on the shared API.

```tsx
// components/ui/button.tsx:L11-L38
const buttonVariants = cva(
  "inline-flex items-center ... focus-visible:outline-transparent",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-orange-500 ...",
        secondary: "bg-white text-slate-800 border ...",
        ghost: "bg-transparent text-white border ...",
      },
      size: {
        sm: "h-9 px-3 py-2 text-sm gap-1.5",
        default: "h-11 px-4 py-3 text-base gap-2",
        lg: "h-13 px-6 py-4 text-lg gap-2",
      },
    },
  }
)
```

### 4.3 Layout/Spacing & Responsive
- ✓ **Expectation**: Layout primitives (containers, stacks) wrap spacing tokens for consistent gutters and responsive steps.
- ✗ **What we found**: Cards and marketing screens repeatedly author `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` and `p-6 gap-6` rather than consuming spacing tokens exported from the design system. This inflates diffs and risks drift when padding updates are required.【F:components/ui/card.tsx†L8-L54】【F:app/pricing/page.tsx†L124-L214】 Repetition surfaced via search.【264095†L1-L8】 
- 🔧 **Recommendations**: Publish `Container` / `Section` primitives that encapsulate tokenized padding (e.g. `spacingSemantic.section.lg`), and migrate cards to use `spacingComponent.card.padding` rather than Tailwind literals.

```tsx
// components/ui/card.tsx:L15-L33
const cardVariants = cva(
  "flex flex-col relative rounded-xl transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-white border border-slate-200 shadow-sm ...",
      },
      size: {
        default: "p-6 gap-6",
      },
    },
  }
)
```

### 4.4 Theming/Dark Mode
- ✓ **Expectation**: Root layout mounts a theme controller that toggles `.dark`, and components respect semantic colors.
- ✗ **What we found**: `globals.css` defines extensive CSS variables for light/dark palettes, but `app/layout.tsx` never wires in a theme provider, leaving the body class static. Components like ScoreChart and marketing badges inline fixed colors, so they ignore dark tokens even if the class is toggled manually.【F:app/globals.css†L45-L122】【F:app/layout.tsx†L32-L48】【F:components/diagnostic/ScoreChart.tsx†L12-L124】 Dark-mode utility usage is sparse per search.【8a9d68†L1-L12】 
- 🔧 **Recommendations**: Introduce `ThemeProvider` (e.g. `next-themes`) that synchronizes `class` on `<html>`, audit components to consume semantic colors, and add a design token lint to block inline hex usage.

```tsx
// app/layout.tsx:L32-L47
<body className="antialiased font-sans" suppressHydrationWarning>
  <ErrorBoundary>
    <AuthProvider>
      <Navbar />
      <main id="main-content" className="pt-[72px]">
        <PostHogProvider>
          <SessionTrackingProvider>{children}</SessionTrackingProvider>
        </PostHogProvider>
      </main>
    </AuthProvider>
  </ErrorBoundary>
</body>
```

### 4.5 Accessibility
- ✓ **Expectation**: Interactive components provide visible focus, correct semantics, and avoid color-only cues.
- ✗ **What we found**: `Button` base styles remove focus outlines (`focus-visible:outline-transparent`), undermining keyboard discoverability. Pricing CTAs omit `type`, defaulting to `submit` in forms, and rely on background color alone for plan emphasis. ScoreChart communicates status by color without text alternative beyond the label, which may not meet contrast requirements on dark backgrounds.【F:components/ui/button.tsx†L11-L65】【9275bd†L1-L2】【F:components/pricing/PricingCard.tsx†L205-L241】【F:components/diagnostic/ScoreChart.tsx†L12-L124】 
- 🔧 **Recommendations**: Reinstate visible focus rings using semantic tokens, set explicit `type` attributes, and add icon/text combos (e.g. success icons) that do not rely solely on color.

```tsx
// components/pricing/PricingCard.tsx:L223-L241
<button
  onClick={() => priceId && onCheckout(priceId, tier.name)}
  disabled={isLoading || !priceId}
  className={cn(
    "w-full rounded-lg px-6 py-3 text-center font-semibold transition-all duration-200",
    tier.recommended
      ? "bg-gradient-to-r from-blue-600 to-cyan-600 ..."
      : "bg-gray-900 text-white hover:bg-gray-800"
  )}
>
  {isLoading ? ... : "Get Started"}
</button>
```

### 4.6 Storybook/Ladle
- ✓ **Expectation**: Interactive docs or Ladle showcase components, tokens, and states.
- ✗ **What we found**: `.storybook` is absent, searching for `*.stories.tsx` returns nothing, and the `/design-system` route simply redirects to `/`, so there is no canonical component gallery or visual regression surface.【da6a9e†L1-L3】【310bbb†L1-L2】【F:app/design-system/page.tsx†L1-L7】 
- 🔧 **Recommendations**: Bootstrap Ladle or Storybook pointed at `components/ui` and `lib/design-system`, include token stories, and integrate Chromatic/visual snapshotting in CI.

```
Command: `ls .storybook`
Result: ls: cannot access '.storybook': No such file or directory
```

### 4.7 CI Guardrails
- ✓ **Expectation**: CI enforces linting, type-checking, unit tests, and ideally visual/a11y checks for design-regression coverage.
- ✗ **What we found**: The Cloud Run workflow runs `npm run lint` and `tsc --noEmit`, but unit tests (`npm test`) and Playwright suites are skipped on pull requests, and there is no visual or token-drift check.【38a84e†L1-L86】【F:package.json†L5-L30】 
- 🔧 **Recommendations**: Add Jest/Playwright jobs gated on PRs, wire in a Storybook build with Chromatic (or similar), and include a lint rule or script that verifies components only use approved token utilities.

```yaml
# .github/workflows/deploy-to-cloud-run.yml:L27-L60
- name: Install dependencies
  run: npm ci
- name: Run ESLint
  run: npm run lint
- name: Type check
  run: npx tsc --noEmit -p tsconfig.build.json
```

### 4.8 Pattern Reuse
- ✓ **Expectation**: Feature modules compose from shared patterns (cards, page headers, empty states) defined by the design system.
- ✗ **What we found**: Marketing sections define their own `designTokens` objects with Tailwind strings, and pricing rebuilds cards/buttons inline instead of composing `Card` + `Button`. The exported design-system patterns (`cardVariants`, `buttonVariants`) remain unused, causing drift across experiences.【F:components/sections/TrustedBySection.tsx†L10-L118】【F:components/pricing/PricingCard.tsx†L205-L264】【F:lib/design-system/components.ts†L10-L108】 
- 🔧 **Recommendations**: Publish ready-to-consume pattern components (`<PageHeader>`, `<PricingCard>` driven by tokens) within `lib/design-system`, codemod feature code to compose them, and delete local token maps in favor of central APIs.

```tsx
// components/sections/TrustedBySection.tsx:L10-L48
const designTokens = {
  colors: {
    background: "bg-white dark:bg-slate-950",
    surface: "bg-white dark:bg-slate-900",
    text: {
      primary: "text-slate-800 dark:text-white",
    },
  },
  spacing: {
    section: "py-16 md:py-20",
    container: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
  },
}
```

## 5. Lighthouse/UX Snapshot (informational)
No Lighthouse run — the audit environment does not start the Next.js dev server, so performance metrics were not collected this round.

## 6. Findings Register
| ID | Priority | Area | File(s) | Evidence | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F-01 | P1 | Tokens & Theme | `components/diagnostic/ScoreChart.tsx`, marketing badges | Inline hex colors for status and badges bypass semantic tokens.【F:components/diagnostic/ScoreChart.tsx†L12-L124】【F:components/marketing/sections/enhanced-social-proof.tsx†L16-L146】 | Replace with `colorSemantic` / Tailwind token classes and add lint to forbid raw hex in JSX. |
| F-02 | P1 | Component Variants & A11y | `components/ui/button.tsx` | Button CVA ignores design tokens and strips visible focus outline.【F:components/ui/button.tsx†L11-L65】【9275bd†L1-L2】 | Generate button classes from design-system config and restore tokenized focus ring. |
| F-03 | P1 | Docs & Regression | Storybook / Docs | No Storybook or design-system documentation route available.【da6a9e†L1-L3】【310bbb†L1-L2】【F:app/design-system/page.tsx†L1-L7】 | Stand up Storybook/Ladle with component + token stories, hook into CI. |
| F-04 | P2 | Layout discipline | Pricing, shared cards | Repeated container padding strings instead of spacing tokens.【F:components/ui/card.tsx†L8-L54】【F:app/pricing/page.tsx†L124-L214】 | Ship `<Container>` utility wired to spacing tokens and adopt across pages. |
| F-05 | P2 | Theming | `app/layout.tsx`, globals | Theme variables defined but no provider toggles `.dark` globally.【F:app/globals.css†L45-L122】【F:app/layout.tsx†L32-L48】 | Install `ThemeProvider` to manage `class` and audit components for semantic color usage. |

## 7. Remediation Plan
- **Wave 1 (P1, 1–2 days)**: Tokenize all color usage in diagnostic + marketing surfaces; refactor `Button` to consume design-system variants with visible focus; initialize Storybook/Ladle with at least Button/Card stories and wire to CI smoke build.【F:components/diagnostic/ScoreChart.tsx†L12-L124】【F:components/marketing/sections/enhanced-social-proof.tsx†L16-L146】【F:components/ui/button.tsx†L11-L65】【da6a9e†L1-L3】
- **Wave 2 (P2, 3–5 days)**: Introduce layout primitives using spacing tokens, migrate cards/pricing to them, and add a theme provider plus audit for dark-mode compliance.【F:components/ui/card.tsx†L8-L54】【F:app/pricing/page.tsx†L124-L214】【F:app/globals.css†L45-L122】【F:app/layout.tsx†L32-L48】
- **Wave 3 (P3, 1+ week)**: Expand design-system component coverage (Page headers, Empty states, Tables), add design-token linting in CI, and integrate visual regression (Chromatic/Playwright) into the Cloud Run pipeline.【F:lib/design-system/components.ts†L10-L108】【38a84e†L1-L86】
