# Design System Adoptions

## Tokenized Badge component

- Introduced a reusable `<Badge>` component (`components/ui/badge.tsx`) backed by Tailwind semantic tokens for light/dark parity and accessible focus rings.
- Migrated the Enhanced Social Proof marquee to consume the new Badge, removing inline hex values and bespoke badge styling.

### Usage

**Do**

```tsx
<Badge variant="soft" tone="accent" size="sm" icon={<SparklesIcon />}>
  Blueprint Changes
</Badge>
```

- Leverage semantic `tone` values (`default`, `accent`, `success`, `warning`, `danger`) to communicate meaning.
- Use the `icon` slot for decorative glyphs; icons inherit the badge tone automatically.
- When wrapping interactive elements, pass `asChild` to preserve focus-visible rings.

**Don't**

```tsx
<span style={{ background: "linear-gradient(90deg, #3B82F6, #2563EB)" }}>
  Custom Badge
</span>
```

- Avoid raw hex/gradient declarations in JSX; rely on design tokens instead.
- Skip bespoke padding/typography—`size` variants (`sm`, `md`) already meet touch target guidance.

### Adoption Notes

- Enhanced Social Proof badges now use `variant="soft"` with tone-specific rings for both light and dark themes.
- Future badge/pill surfaces should adopt this component to maintain consistent a11y and token usage.
