# Content loader performance/async tests fail due to environment mismatches

## Summary
The content loader test suites that verify async behaviour and performance budgets are failing. Observed errors include:
- Assertions detecting synchronous `fs` calls where async usage is expected.
- Throughput/latency measurements falling below the target thresholds.
- jsdom throwing `window.document.addEventListener is not a function` when the loader expects browser APIs.

## Impact
- Leaves the content ingestion pipeline without automated regression coverage.
- Indicates that our test environment does not accurately mirror the runtime environment for these modules.
- Risks shipping performance regressions undetected.

## Affected tests
- `__tests__/content-loader/performance.test.ts`
- `__tests__/content-loader/async-behaviour.test.ts`
- Any other suites referenced in the failure output that import the loader utilities.

## Steps to reproduce
1. Install dependencies (`npm install`).
2. Run the content loader suites: `npm test -- __tests__/content-loader`.
3. Observe the combination of failed performance assertions and missing DOM APIs.

## Expected behaviour
- Tests should rely on fully async file system mocks or fixtures, so no synchronous calls are detected.
- Performance expectations should pass with realistic mocked data.
- Required DOM APIs (e.g., `document.addEventListener`) should be polyfilled in the Jest environment when needed.

## Actual behaviour
- Assertions flag synchronous `fs` usage and throughput below expectations.
- jsdom lacks `document.addEventListener`, causing runtime errors.

## Proposed next steps
- Audit the loader implementation to ensure async APIs are used and to determine whether the tests need updated fixtures.
- Consider relaxing or parameterising performance thresholds for deterministic outcomes during unit tests.
- Polyfill or mock any DOM APIs required by the loader before running the suite (e.g., via `jest.setup.ts`).
- Add regression tests to confirm the mocks behave as expected.

## Additional context
- These failures were highlighted in the recent `npm test` run (67 suites executed, 15 failing total) and represent the bulk of the remaining assertions after API/page issues are resolved.
