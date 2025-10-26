# Study path API tests time out and return HTTP 400 instead of 401

## Summary
The study path API Jest suite times out and asserts against incorrect HTTP responses. Requests that should return `401 Unauthorized` for unauthenticated access instead respond with `400 Bad Request`, and some tests exceed Jest's timeout waiting for a reply.

## Impact
- Blocks regression coverage for the study path API endpoints.
- Suggests the handler may be validating input before authentication (returning 400) or misconfigured auth middleware.
- Timeouts slow down the overall test run and obscure the root cause.

## Affected tests
- `__tests__/api/study-path/index.test.ts`
- `__tests__/api/study-path/[id].test.ts`

## Steps to reproduce
1. Install dependencies (`npm install`).
2. Run the failing suites: `npm test -- __tests__/api/study-path`.
3. Observe some tests timing out and others receiving HTTP 400 responses where 401 is expected.

## Expected behaviour
- Unauthenticated requests should short-circuit with a 401 response.
- Tests should complete within the configured timeout.

## Actual behaviour
- Handlers respond with 400 and/or hang until Jest reports a timeout.

## Proposed next steps
- Review the study path API middleware order to ensure authentication runs before request validation.
- Add explicit mocks/stubs for authentication helpers in tests to ensure deterministic responses.
- Investigate whether the handler is awaiting external services that may cause timeouts in Jest.
- Update tests after the handler behaviour is corrected.

## Additional context
- These failures were included in the 15 failing suites (90 failed assertions) from the most recent `npm test` execution.
