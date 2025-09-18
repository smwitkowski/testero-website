# Supabase database schema tests fail with ENOTFOUND to `test.supabase.co`

## Summary
Database schema validation tests fail because the Supabase client cannot resolve `test.supabase.co`, resulting in `ENOTFOUND` errors. These failures occur early in the test lifecycle, preventing subsequent insert/cascade checks from executing.

## Impact
- Leaves our Supabase schema migrations unverified by automated tests.
- Masks potential regressions in row-level security, triggers, and cascading behaviour.
- Slows local development because each run waits for network DNS timeouts.

## Affected tests
- `__tests__/billing/database-schema.test.ts`
- Any other schema verification suites that attempt to connect to the hosted Supabase instance during tests.

## Steps to reproduce
1. Install dependencies (`npm install`).
2. Execute the schema tests: `npm test -- __tests__/billing/database-schema.test.ts`.
3. Observe the `ENOTFOUND test.supabase.co` error emitted by the Supabase client.

## Expected behaviour
- Tests should run entirely against a local or in-memory Supabase emulator, or the database client should be mocked to avoid network calls.
- Schema validations should complete without attempting to resolve external DNS entries.

## Actual behaviour
- Tests attempt to reach `test.supabase.co`, fail DNS resolution, and abort.

## Proposed next steps
- Decide whether schema tests should run against a local Supabase emulator or be fully mocked.
- Update test utilities to point to a reachable host (e.g., a dockerised Supabase instance) when running in CI.
- Alternatively, refactor tests to use static fixtures for schema assertions instead of live connections.
- Ensure connection parameters are configurable via environment variables for easier overrides during tests.

## Additional context
- These failures contributed to the 15 failing suites and 90 failed assertions reported in the latest `npm test` execution.
