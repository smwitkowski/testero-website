# Diagnostic summary integration tests crash because `posthog.getFeatureFlag` is undefined

## Summary
The diagnostic summary client-side integration tests fail early with a runtime error: `posthog.getFeatureFlag is not a function` (or `undefined`). This prevents the diagnostic summary component from rendering inside Jest and causes the suite to abort.

## Impact
- Blocks regression coverage for the diagnostic summary experience, including gating behaviour driven by feature flags.
- Indicates our PostHog test double is missing parity with production usage, which may hide other analytics-related defects.

## Affected tests
- `__tests__/integration/diagnostic-summary.test.tsx` (and any other suite importing the diagnostic summary component).

## Steps to reproduce
1. Install dependencies (`npm install`).
2. Run the failing suite: `npm test -- __tests__/integration/diagnostic-summary.test.tsx`.
3. The component render will throw because `posthog.getFeatureFlag` is not defined on the mocked PostHog client.

## Expected behaviour
- The PostHog mock exposes a `getFeatureFlag` function returning predictable values for tests.
- Diagnostic summary tests render successfully and can assert on the UI state.

## Actual behaviour
- Component rendering throws immediately due to the missing function, causing all assertions to be skipped.

## Proposed next steps
- Extend the PostHog mock used in tests (likely defined in `jest.setup.ts` or a dedicated mock file) to include `getFeatureFlag` with realistic default behaviour.
- Audit the component for other PostHog APIs to ensure the mock stays in sync.
- Add targeted tests that assert the feature-flag-driven branches behave as expected.

## Additional context
- This issue contributed to multiple integration test failures in the last Jest run (67 suites, 15 failures total).
