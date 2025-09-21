# Refactor #09: Card spacing tokens

- **Author:** ChatGPT
- **Date:** 2025-09-21
- **Related ticket:** #9 – Refactor Card to consume spacing tokens

## Summary
- Tokenized all Card padding and gaps through semantic CSS variables and Tailwind spacing aliases.
- Introduced typed `size`, `compact`, and `inset` variants with context-aware subcomponents inheriting spacing.
- Updated consumers, stories, and regression tests; documented migration and validation steps for downstream teams.

## Motivation & scope
Card surfaces were relying on literal Tailwind spacing (`p-6`, `gap-6`) that drifted from the design system. The refactor centralizes spacing through design tokens, exposes a typed API for density adjustments, and prevents ad-hoc overrides. Scope covered the base Card component, its composed sections, Storybook coverage, and direct consumers within `/app` relying on manual padding.

## Inventory & baseline
Captured prior to refactor to understand class usage and touchpoints:

```bash
$ rg -n "(\bp-\d|\bgap-\d|\bp-\[|\bgap-\[)" components/ui/card.tsx app components | wc -l
330

$ rg -n "class(Name)?=.*(p-|gap-).*Card" app components
# no matches

$ rg -n "Card( |\.)" app components | head -n 20
app/waitlist/page.tsx:22:        {/* Card Container */}
components/examples/DesignSystemDemo.tsx:188:      {/* Card Demo */}
app/beta/page.tsx:257:              <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50">
app/diagnostic/page.tsx:261:      <Card className="border-slate-200 shadow-sm p-6 md:p-7">
...
```

These counts anchored the documentation and migration audit.

## Token additions
Card spacing tokens now live alongside existing primitives:

| Token | Semantic usage | CSS value |
| --- | --- | --- |
| `--space-card-x-sm` | Compact horizontal padding | `0.75rem` (12px) |
| `--space-card-y-sm` | Compact vertical padding | `0.75rem` (12px) |
| `--gap-card-sm` | Tight section gap | `0.5rem` (8px) |
| `--space-card-x-md` | Default horizontal padding | `1rem` (16px) |
| `--space-card-y-md` | Default vertical padding | `1rem` (16px) |
| `--gap-card-md` | Default inter-section gap | `0.75rem` (12px) |
| `--space-card-x-lg` | Spacious horizontal padding | `1.5rem` (24px) |
| `--space-card-y-lg` | Spacious vertical padding | `1.25rem` (20px) |
| `--gap-card-lg` | Spacious inter-section gap | `1rem` (16px) |
| `--space-card-x` | Alias for default horizontal padding | `var(--space-card-x-md)` |
| `--space-card-y` | Alias for default vertical padding | `var(--space-card-y-md)` |
| `--gap-card` | Alias for default gap | `var(--gap-card-md)` |

All tokens are mirrored inside `.dark` for parity and surfaced through `tailwind.config.ts` (`px-card-x-sm`, `gap-card-md`, `-mx-card-x-lg`, etc.).

## Before / after excerpts
**Before (keylines, ≤25):**
```tsx
const cardVariants = cva(
  "flex flex-col relative rounded-xl transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5",
      },
      size: {
        sm: "p-4 gap-4",
        default: "p-6 gap-6",
        lg: "p-8 gap-8",
      },
    },
  }
)
```

**After (keylines, ≤25):**
```tsx
const cardVariants = cva(
  "relative flex flex-col rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm transition-all duration-200",
  {
    variants: {
      variant: { /* ... */ },
      size: { sm: "", md: "", lg: "" },
      compact: { false: "", true: "" },
      inset: { none: "", content: "", all: "" },
    },
    defaultVariants: { variant: "default", size: "md", compact: false, inset: "none" },
  }
)

const spacingClasses = cn(
  horizontalPadding[size],
  compact ? compactVerticalPadding[size] : verticalPadding[size],
  compact ? compactGapSpacing[size] : gapSpacing[size]
)
```

The refactor replaces literal spacing with token-driven helpers and introduces a context provider so `CardHeader`, `CardContent`, `CardFooter`, and `CardAction` inherit the active size/density without duplicated class logic.

## Variant API overview
- `size: "sm" | "md" | "lg"` — controls horizontal padding, vertical rhythm, and root gap.
- `compact?: boolean` — keeps horizontal padding while stepping vertical padding/gap down one token tier.
- `inset: "none" | "content" | "all"` — allows content (or all sections) to bleed to card edges using negative token margins plus re-applied token padding.
- `allowInternalSpacingOverride?: boolean` — explicit escape hatch when legacy consumers must keep manual padding (requires justification comment per guidelines).

`CardHeader`, `CardContent`, `CardFooter`, and `CardAction` subscribe to the shared context, ensuring consistent spacing without manual overrides. Storybook stories and Jest snapshots exercise each variant.

## Consumer migration checklist
- [x] Replace `p-*` / `gap-*` on `<Card>` with `size` and `compact` props.
- [x] Audit `CardHeader`, `CardContent`, `CardFooter` usage for manual padding; remove or replace with token utilities (`px-section_md`, `gap-card-sm`, etc.).
- [x] Use `inset="content"` when sections need edge-to-edge backgrounds instead of negative margins.
- [x] Only set `allowInternalSpacingOverride` alongside a `// justified:` comment explaining why tokens cannot be used (no current usages remain).
- [x] Update Storybook stories and MDX guidelines to educate downstream teams.

## Validation checklist
- ✅ `npm run lint`
- ✅ `npm run test` (Jest suite; includes new `Card` spacing assertions)
- ✅ `npm run build`
- 🔄 Storybook stories updated for all variants (light/dark, compact, inset). Screenshot capture is pending CI pipeline due to headless environment constraints; manual smoke test via `npm run storybook` recommended locally.

## Rollback plan
If regressions surface, revert the following commits in order:
1. `components/ui/card.tsx` to previous literal-spacing implementation.
2. Remove the newly added spacing variables from `styles/tokens.css` and `tailwind.config.ts`.
3. Drop the Card-focused stories, tests, and documentation updates (`stories/ui/Card.*`, `__tests__/components/card.test.tsx`, this file).

All changes are isolated to Card internals and consumer padding; reverting restores the prior API without affecting unrelated modules.

## Appendix: artifacts & references
- Storybook coverage: `stories/ui/Card.stories.tsx`, `stories/ui/Card.docs.mdx`.
- Tests: `__tests__/components/card.test.tsx` (spacing, compact, inset).
- Consumer updates: `app/diagnostic/page.tsx`, `app/faq/page.tsx`, `app/faq/[slug]/FaqClientContent.tsx`.
