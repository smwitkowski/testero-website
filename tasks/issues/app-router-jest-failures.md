# Next.js router-dependent page tests fail with "expected app router to be mounted"

## Summary
Multiple Jest suites that render Next.js pages/components relying on the App Router fail with invariant violations such as `Invariant: expected app router to be mounted` and React ref warnings. The routing context expected by these components is not available in the test environment, causing each render attempt to throw.

## Impact
- Blocks automated coverage for key pages (beta signup, forgot password, etc.).
- Suggests we are mounting App Router components in a test environment configured for the Pages Router.
- Prevents validation of routing guards, redirects, and other navigation logic.

## Affected tests
- Any Jest suite rendering App Router components, including:
  - `__tests__/pages/beta-page.test.tsx`
  - `__tests__/pages/forgot-password-page.test.tsx`
  - Additional page-level tests referenced in the failing run output.

## Steps to reproduce
1. Install dependencies (`npm install`).
2. Run one of the affected suites: `npm test -- __tests__/pages/beta-page.test.tsx`.
3. Observe the invariant violation complaining about the App Router not being mounted.

## Expected behaviour
- Components should render inside a mocked environment that provides the same router context they receive in production.
- Tests can assert on routing behaviour without runtime crashes.

## Actual behaviour
- Rendering throws before assertions run, producing invariant and React ref warnings.

## Proposed next steps
- Introduce a shared helper that wraps App Router components with the appropriate testing harness (e.g., `AppRouterContext.Provider`).
- Alternatively, refactor tests to mock `next/navigation` hooks (such as `useRouter`) rather than rendering the entire page.
- Ensure the Jest environment is configured to mimic the App Router runtime expectations.
- Update failing suites to use the helper and verify rendering completes.

## Additional context
- These errors were called out in the last `npm test` run summary (67 suites run, 15 failing) and represent a large fraction of the front-end failures.
