# Signup page analytics tests fail due to unexpected arguments on mock calls

## Summary
The signup page Jest suite is failing because analytics tracking mocks (e.g., Segment/PostHog) receive additional arguments beyond what the assertions expect. The mismatch causes assertions like `toHaveBeenCalledWith` to fail even though the underlying call likely remains correct.

## Impact
- Blocks automated regression coverage of the signup flow.
- Indicates our analytics mock expectations are outdated relative to the production implementation.
- Introduces the risk of real regressions being ignored because the suite is red by default.

## Affected tests
- `__tests__/pages/signup-page.test.tsx`
- Any other suite importing the signup component with similar analytics expectations.

## Steps to reproduce
1. Install dependencies (`npm install`).
2. Run the suite: `npm test -- __tests__/pages/signup-page.test.tsx`.
3. Observe assertion failures indicating analytics mocks were called with unexpected extra parameters.

## Expected behaviour
- Mocks should mirror the live analytics API signature, and assertions should be updated accordingly.
- Tests should pass when the component triggers analytics with the correct payload.

## Actual behaviour
- Assertions fail because the mock call arguments include additional metadata or context objects not covered by the test expectations.

## Proposed next steps
- Inspect the signup component to document the current analytics call signature.
- Update the Jest mocks to accept the same argument shape, or adjust assertions to use `expect.objectContaining` for flexible matching.
- Add regression tests for the additional metadata to ensure the payload stays correct in the future.

## Additional context
- This failure was reported in the last `npm test` execution (67 suites run, 15 failing) as part of the client-side failure set.
