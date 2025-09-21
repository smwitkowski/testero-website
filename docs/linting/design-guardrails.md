# Design Guardrails

To keep the UI system themeable and consistent, we lint for two high-risk patterns:

1. **Raw color literals** such as `"#0ea5e9"`, `rgb(…)`, and `hsl(…)`
2. **Tailwind arbitrary values** such as `bg-[#0ea5e9]`, `w-[742px]`, and `z-[9999]`

These rules ensure we reach for semantic design tokens and shared utilities instead of one-off values that break dark mode, accessibility, or responsive layouts.

## Rules

### `design/no-raw-colors`

* **Blocks** any string literal or template literal segment that is exactly a raw color literal.
* **Allowed**: tokens such as `var(--accent)` or `hsl(var(--accent))`.
* **Warns** (configured via `.eslintrc`) rather than errors in `__tests__/` and `*.spec.*` files so fixtures remain easy to author.

**Fix guidance:** map to semantic tokens (`text-fg`, `bg-accent`, `var(--border)`) or create a new token with the design team.

### `design/no-tailwind-arbitrary-values`

* **Blocks** arbitrary Tailwind values in `className`/`class` strings and popular merge helpers (`clsx`, `classnames`, `cn`).
* Detects color literals, hard-coded spacing/sizing (`w-[742px]`), absolute z-indexes (`z-[9999]`), and typography overrides (`leading-[1.1]`, `tracking-[-0.02em]`).
* Line-height and tracking overrides default to **warnings** so teams can migrate gradually. Flip `warnLineHeightAndTracking` in `eslint-rules.config.json` to escalate.
* Stories (`*.stories.tsx|mdx`) only warn and scripts are fully exempt via `.eslintrc` overrides.

**Fix guidance:**

* Replace with tokens/utilities (`w-72`, `text-muted`, `z-overlay`, `leading-tight`).
* If a token is missing, work with design to add it. Leave a TODO + tracking ticket if you must add a temporary allowlist entry.

## Configuration & Overrides

Project-level options live in [`eslint-rules.config.json`](../../eslint-rules.config.json):

```json
{
  "warnLineHeightAndTracking": true,
  "exemptPaths": ["scripts/**"],
  "classMergeHelpers": ["clsx", "classnames", "cn"],
  "allowlistPath": ".lint-rules-allowlist.json"
}
```

### Allowlist

Use [`.lint-rules-allowlist.json`](../../.lint-rules-allowlist.json) for explicit exceptions. Both path globs and class regexes are supported. Example:

```json
{
  "paths": ["components/charts/**"],
  "classPatterns": ["^grid-cols-\\[auto-fit,minmax\\(.*\\)\\]$"]
}
```

Only add entries with reviewer approval and a follow-up task to remove them.

## Running locally

```bash
npm run lint
npm run test:eslint-rules
```

CI runs both commands on every PR. Any error blocks the build; warnings are surfaced in the lint report so you can plan migrations.

## Troubleshooting

* Seeing a false positive? Capture a minimal reproduction and add a regression test in `eslint/tests/` before changing the rule.
* Need a temporary escape hatch? Add it to `.lint-rules-allowlist.json` with a comment referencing the tracking issue, then remove it once the token exists.
* Questions? Ping the design systems channel with your use case.
