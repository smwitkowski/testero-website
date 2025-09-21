# Section Primitive Rollout

## Summary
- Added a reusable `<Section>` layout primitive with typed variants for rhythm (`size`), background surfaces (`surface`), and dividers (`divider`).
- Introduced tokenised spacing and surface variables so Tailwind can generate semantic utilities (`py-section_lg`, `bg-surface-muted`, etc.).
- Documented the component in Storybook with interactive controls and dark-mode preview, plus unit tests for variant composition.
- Migrated representative marketing surfaces (pricing page, trusted-by carousel, enhanced social proof) to validate the API and remove ad-hoc `py-16` patterns.
- Added an ESLint helper that nudges authors toward the primitive when legacy section padding classes appear.

## Component API
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | `"lg"` | Maps to `py-section_*` spacing tokens (24/32/48/64px). |
| `surface` | `"default" \| "subtle" \| "muted" \| "elevated" \| "brand"` | `"default"` | Applies semantic surfaces backed by CSS variables. `elevated` includes a shadow token. |
| `divider` | `"none" \| "top" \| "bottom" \| "both"` | `"none"` | Uses the divider color token so borders adapt to themes. |
| `contained` | `boolean` | `true` | Wraps children in the shared `Container` primitive (max-width + responsive padding). Set `false` for full-bleed layouts. |
| `as` | block-level element | `"section"` | Polymorphic tag support for semantic markup. |
| `className` | `string` | — | Merged with computed variants via `cn`. |

### Usage Examples
```tsx
<Section size="lg" surface="default">
  <PageHeader title="Pricing" description="Choose the plan that fits." />
</Section>

<Section size="xl" surface="subtle" divider="top">
  <FeaturesGrid />
</Section>

<Section size="md" surface="brand" divider="both" contained={false}>
  <WideHero />
</Section>
```

## Design Tokens & Tailwind Extensions
- Added `styles/tokens.css` with CSS variables for section rhythm (`--section-sm` → `--section-xl`), surface aliases (`--surface-default`, `--surface-brand`, etc.), and the shared divider color.
- Imported the token sheet from `app/globals.css` so the variables flow to every theme.
- Extended `tailwind.config.ts` to expose the new spacing keys (`section_sm` → `section_xl`) and semantic colors (`surface.*`, `divider`). This allows ergonomics like `py-section_md` or `bg-surface-muted` across the app.

## Storybook & Tests
- `components/patterns/section.stories.tsx` showcases the primitive with controls for every variant and a full-bleed example. The global theme toolbar handles light/dark previews.
- `components/patterns/__tests__/section.test.tsx` verifies default/variant class composition and the `contained` behaviour.

## Migrated Sections (Before → After)
### `app/pricing/page.tsx`
- **Before:** Each band used bespoke wrappers like `<div className="py-16 bg-gray-50">` or `<Container className="py-16">`.
- **After:** `<Section>` instances handle the hero, pricing cards, AI credits, social proof, comparison grid, FAQ, and CTA—with semantic surfaces (`surface="subtle"`) and dividers that align to the design system.

### `components/sections/TrustedBySection.tsx`
- **Before:** Component-level token map defined `spacing.section = "py-16 md:py-20"` and rendered a raw `<section>`.
- **After:** `<Section size={isCompact ? "md" : "xl"}>` provides rhythm while the component focuses on marquee logic. Local spacing tokens now only cover logo sizing.

### `components/marketing/sections/enhanced-social-proof.tsx`
- **Before:** Manual `py-12 md:py-16` and a standalone `<Container>`.
- **After:** `<Section size="lg">` wraps the content, keeps the shared container padding, and still works with the `useInView` ref.

## Migration Checklist
1. Replace `div`/`section` wrappers that only provide vertical padding or background colour with `<Section>`.
2. Choose a `size` token that matches the intent (`lg` for 48px, `xl` for 64px). Avoid re-adding raw `py-16` utilities.
3. Pick a `surface` variant instead of hard-coded `bg-*` utilities when possible.
4. Enable dividers via `divider="top"|"bottom"|"both"` rather than manual `border-t` strings.
5. Leave `contained` at the default unless a section needs to be full-bleed—then supply your own inner wrapper (e.g., `<Container>` or custom grid).
6. Delete redundant local spacing tokens once `<Section>` is in place.

## ESLint Assist
A `no-restricted-syntax` rule warns when class strings contain the legacy section padding utilities (`py-16`, `md:py-20`, etc.). Use `<Section size="lg" />` instead. If a one-off layout genuinely requires the old pattern, add `// eslint-disable-next-line no-restricted-syntax` above the JSX attribute with justification.

## Testing & Verification
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run storybook:build`
