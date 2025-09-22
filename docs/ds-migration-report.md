# Design System Migration Report

_Last updated: 2025-09-21 23:26 UTC_

## Summary
- Introduced codemod toolchain for removing local design token objects, normalising containers/sections, upgrading buttons, swapping badges, and flagging raw hex usage.
- Migrated marketing and pricing surfaces to consume `<Section>`, `<Container>`, `<Card>`, `<Button>`, and `<Badge>` primitives from the central design system.
- Added Storybook coverage for Container, Badge, and PricingCard to document new variant APIs, plus CLI/ESLint guardrails that block ad-hoc gradients and arbitrary Tailwind values.

## Migrated Modules
| Module | Key Patterns Adopted | Notes |
| --- | --- | --- |
| `components/sections/TrustedBySection.tsx` | `<Section>`, `<Badge tone="accent">`, `<Card compact>` | Removed bespoke `designTokens` map and gradient masks now use semantic background tokens. |
| `components/pricing/PricingCard.tsx` | `<Card variant="elevated">`, `<Button tone="accent">`, `<Badge tone>` | CTA now leverages DS button spinner/variants, highlight list reuses semantic success/accent tokens. |
| `components/marketing/sections/enhanced-social-proof.tsx` | `<Section size="lg">`, `<Badge variant="soft">`, `<Card size="sm">` | Replaced arbitrary width tokens and deprecated text utilities with DS typography colours. |
| `components/diagnostic/ScoreChart.tsx` | `<Badge tone>` | Score status chips now rely on DS badge variants while keeping SVG rendering intact. |

## Codemod & Guardrail Tooling
- `scripts/codemods/ds/run-all.ts` orchestrates:
  - `remove-local-designTokens.ts`
  - `wrap-with-container-section.ts`
  - `button-to-ds-variants.ts`
  - `badge-and-status.ts`
  - `hex-to-semantic.ts`
- Added npm scripts `codemod:ds:dry`, `codemod:ds:run`, and `lint:design`.
- `scripts/guards/design-lints.js` blocks raw hex values and Tailwind arbitrary values across app, components, and lib directories.
- `lint-staged` + `simple-git-hooks` enforce pre-commit design linting.
- ESLint now loads `eslint-plugin-tailwindcss` and errors on `tailwindcss/no-arbitrary-value`.

## Before & After Highlights
### TrustedBySection
```diff
-const designTokens = { /* bespoke colours, spacing, effects */ }
-<div className="text-center mb-8 md:mb-12">
-  <h2 className={cn(designTokens.typography.sectionTitle, designTokens.colors.text.primary)}>
-    {title}
-  </h2>
-</div>
+<Badge tone="accent" variant="soft" className="w-fit">Trusted by teams</Badge>
+<h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
+  {title}
+</h2>
+<LogoCard ...>
+  <Card className="group relative flex h-20 w-40 ..." compact allowInternalSpacingOverride>
+    <Image className="h-12 w-auto ..." />
+  </Card>
+</LogoCard>
```

### PricingCard
```diff
-<div className="relative ... rounded-2xl border-2 bg-white p-8 shadow-lg">
-  {tier.recommended && (
-    <div className="absolute left-1/2 top-6 ... bg-gradient-to-r from-blue-600 to-cyan-600 ...">
-      MOST POPULAR
-    </div>
-  )}
-  <button className="w-full rounded-lg px-6 py-3 ...">
-    Get Started
-  </button>
-</div>
+<Card variant={tier.recommended ? "elevated" : "default"} className="relative w-full">
+  {tier.recommended ? (
+    <Badge tone="accent" variant="solid" icon={<Sparkles className="h-4 w-4" />}>Most popular</Badge>
+  ) : null}
+  <CardContent className="gap-6">
+    <Button
+      fullWidth
+      tone={tier.recommended ? "accent" : "neutral"}
+      variant="solid"
+      size="lg"
+      loading={isLoading}
+    >
+      Get started
+    </Button>
+  </CardContent>
+</Card>
```

### ScoreChart
```diff
-const toneClassMap = { success: "text-success", warning: "text-warning", error: "text-error" }
-...
-{showStatus && (
-  <span className={cn("text-sm font-medium", toneClass)}>
-    {getScoreStatus(displayScore)}
-  </span>
-)}
+const toneClassMap = { success: "text-success", warning: "text-warning", danger: "text-error" }
+...
+{showStatus ? (
+  <Badge tone={tone} variant="soft" size="sm">
+    {getScoreStatus(displayScore)}
+  </Badge>
+) : null}
```

## Dark Mode Validation
- Verified components under a `.dark` root with Storybook controls: surfaces inherit `bg-surface`, text uses `text-foreground`/`text-muted-foreground`, and badges/buttons respect semantic tones in dark theme.
- `TrustedBySection` gradient masks now reference `background` tokens to avoid washed-out fades.

## Outstanding TODOs & Follow-ups
- Codemod heuristics insert `// TODO(ds-migration)` comments when encountering unmapped local token usages or unknown hex literals. Review and replace these with the closest semantic classes as they appear.
- Investigate a Tailwind v4-compatible release of `eslint-plugin-tailwindcss` to remove `--legacy-peer-deps` from local installs once available.
- Expand codemod coverage to marketing landing pages outside the initial scope (e.g., hero sections) after validating current passes on CI.
