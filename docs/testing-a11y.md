# Accessibility Testing Guide

This repository runs two layers of accessibility coverage:

- **Component smoke tests** with Jest, React Testing Library, and `jest-axe`
- **End-to-end smoke tests** with Playwright and `@axe-core/playwright`

Both suites execute in CI on every pull request. The sections below describe how to run them locally, extend coverage, and troubleshoot common issues.

## Prerequisites

- Node.js 20 (the same version configured in CI)
- Project dependencies installed via `npm ci`
- Playwright browsers installed once locally with `npx playwright install chromium`

> **Tip:** CI caches the Playwright browser bundle. When running locally, the first `npx playwright install chromium` download may take a few minutes; subsequent runs are instantaneous.

## Commands

| Scenario | Command |
| --- | --- |
| Run Jest unit tests (watch mode) | `npm run test` |
| Run Jest unit tests in CI mode | `npm run test:ci` |
| Run the full Playwright suite | `npm run e2e` |
| Run Playwright in CI mode | `npm run e2e:ci` |
| Show the latest Playwright HTML report | `npm run e2e:report` |

Both suites expect to run against a production build of the Next.js app. The Playwright config automatically builds (`npm run build`) and starts (`npm run start`) the app before tests. To reuse an already running server, export `PLAYWRIGHT_SKIP_WEB_SERVER=1` and set `PLAYWRIGHT_BASE_URL` to the running host.

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e
```

## Writing new component accessibility tests

1. Import the component inside `__tests__/a11y/` and render it with React Testing Library.
2. Scope `axe` to the render container to keep scans fast and deterministic.
3. Check **both light and dark themes** by toggling `document.documentElement.classList.add("dark")`.
4. Assert keyboard semantics: focus rings, ARIA attributes, `type="button"` defaults, and disabled behavior.
5. Prefer semantic queries (`getByRole`, `getByLabelText`) over `querySelector`.

Example skeleton:

```tsx
import { render } from "@testing-library/react"
import { axe } from "jest-axe"

const { container } = render(<Component />)
expect(await axe(container)).toHaveNoViolations()
```

## Writing new Playwright accessibility tests

- Place specs under `e2e/` and import helpers from `@axe-core/playwright`.
- Always confirm the page responds with a successful status before asserting.
- Run `checkA11y` in **light** and **dark** modes. Toggle dark mode with `page.addInitScript` or `page.evaluate`.
- Use keyboard interactions (`page.keyboard.press('Tab')`, `page.keyboard.press('Enter')`) instead of clicks when verifying focus management.
- Attach any helpful artifacts (JSON summaries, screenshots) via `testInfo.attach` for easier CI triage.
- When validating "recommended"/"featured" treatments, assert there is text or ARIA labelling in addition to color. The pricing page currently surfaces a "Most popular" badge as the non-color cue; ensure future designs follow the same pattern.

## Troubleshooting

- **Playwright build failures:** ensure `npm run build` passes before launching tests. The web server step uses the production build output.
- **Hanging tests locally:** add `DEBUG=pw:api` to inspect Playwright actions, or run `npm run e2e -- --headed` to observe focus behavior.
- **Axe violations:** review the attached `axe-*.json` files in CI artifacts. They list the failing nodes, rules, and suggested fixes.
- **Dark mode regressions:** tests rely on the `dark` class on `<html>` and `<body>`. If a component uses a different theming strategy, update the test harness accordingly.
- **Pricing CTA disabled:** if you run the Next.js server manually for Playwright, provide placeholder Stripe IDs (e.g. `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY=price_test_basic_monthly`) so the pricing CTAs stay focusable. The shared Playwright config injects safe defaults automatically when it builds the app.

Keeping tests lean (render a few representative variants, avoid unnecessary waits) helps the suites finish within minutes locally and in CI. When adding new coverage, mirror these patterns for consistency.
