# Storybook design system reference

This document captures the initial Storybook integration for the Testero design system. It explains what was installed, how Tailwind and the token theme are wired in, and how to extend the gallery going forward.

## Summary of work

- Added Storybook 8.6 using the React/Webpack 5 framework with Next's Babel preset so token-aware components compile consistently.
- Registered accessibility, essentials, interactions, and themes add-ons so that stories ship with docs, controls, a11y checks, and dark mode toggles.
- Imported the global Tailwind layer (`app/globals.css`) directly in `.storybook/preview.tsx` to expose our CSS variables, typography, and utilities inside the Storybook canvas.
- Authored three starter story groups:
  - **UI/Button** – demonstrates variant, tone, and size combinations plus a keyboard-focus interaction test.
  - **UI/Card** – showcases layout composition, elevation, and action slots backed by spacing tokens.
  - **Foundations/Tokens** – docs-only CSF story that previews semantic colors, typography scales, spacing, and radius tokens.
- Added npm scripts (`storybook`, `storybook:build`, `storybook:preview`) for local development, static builds, and serving the build output.

## Prerequisites

Storybook is installed as dev dependencies. Run `npm install` if your local modules are stale.

## Commands

| Task | Command | Notes |
| --- | --- | --- |
| Launch Storybook locally | `npm run storybook` | Starts on port 6006 with hot reload. |
| Build static Storybook | `npm run storybook:build` | Outputs to `storybook-static/` using the Webpack 5 builder. |
| Preview built bundle | `npm run storybook:preview` | Serves the static output on port 6007 via `http-server`. |

## Add-ons enabled

| Add-on | Purpose |
| --- | --- |
| `@storybook/addon-essentials` | Controls, Docs, Actions, Backgrounds, Viewport, Measure/Outline to aid component review. |
| `@storybook/addon-a11y` | Runs axe-based accessibility checks and exposes the Accessibility panel. |
| `@storybook/addon-interactions` & `@storybook/test` | Enables `play` functions (e.g., keyboard focus demo on the button) and interaction testing utilities. |
| `@storybook/addon-themes` | Adds the Light/Dark theme switcher that toggles the `dark` class on `<html>`. |

## Tailwind and theming integration

- `.storybook/preview.tsx` imports `app/globals.css`, which bootstraps Tailwind v4, the CSS variables defined for light/dark mode, and shared typography rules.
- The themes add-on decorates stories with `withThemeByClassName`, switching the `dark` class on the `<html>` element. This mirrors the app’s class-based dark mode strategy so Tailwind’s `dark:` variants respond correctly.
- A wrapper decorator keeps the Storybook canvas aligned with application defaults (`font-sans`, `antialiased`, background/token colors).

## Story locations & patterns

- Central stories live under `stories/` (e.g., `stories/ui/Button.stories.tsx`).
- The design token reference lives at `stories/foundations/Tokens.stories.tsx` with a docs-only story that renders the `TokenDocsPage` component.
- Future component stories can be colocated next to their source files thanks to the `../components/**/*.stories.@(tsx|mdx)` glob in `.storybook/main.ts`.
- Prefer typed stories (`satisfies Meta<typeof Component>`) and keep controls in sync with CVA variants or prop unions.

### Adding a new component story

1. Create `ComponentName.stories.tsx` alongside the component or under `stories/ui/`.
2. Import the real UI component from `@/components/...`.
3. Export a `meta` object typed with `Meta<typeof Component>` and provide sensible `args`/`argTypes` based on design tokens.
4. Avoid hard-coded hex or pixel values—lean on Tailwind utilities (`bg-card`, `text-muted-foreground`, `gap-4`, etc.) so light/dark themes stay aligned.
5. Add focused examples (default state, variants, composition) and use `play` functions when you need to demonstrate focus or interactions.

## Screenshot checklist for reviewers

When reviewing visual changes, capture:

- [ ] **Light theme** – desktop viewport (~1280px) covering each updated story.
- [ ] **Dark theme** – toggle the Themes toolbar to “Dark” and re-capture key states.
- [ ] **Mobile viewport** – use the Viewport addon (e.g., iPhone 12) for components with responsive behavior.
- [ ] **Focus states** – tab through interactive controls (e.g., buttons) to verify token-driven focus rings.

## Known caveats & next steps

- Token documentation currently renders primitive spacing values up to `24` (96px). Extend the grid if larger primitives become common.
- Card variants still rely on some legacy Slate classes; future work should migrate them fully to semantic token utilities.
- Visual regression automation (Chromatic or Playwright image snapshots) is not configured yet; plan to add in a follow-up task.
- Upgrading to Storybook’s `@storybook/nextjs` framework hit a Webpack tap hook error with Next.js 15; once upstream support lands we can drop the React/Webpack workaround.
- MDX-based token docs currently fail Storybook’s indexing step, so the token reference is delivered via a typed CSF docs story until the MDX3 indexer ships for the React/Webpack builder.
- If additional global stylesheets (fonts, MDX styles) are introduced, import them in `.storybook/preview.tsx` so Storybook mirrors production.
