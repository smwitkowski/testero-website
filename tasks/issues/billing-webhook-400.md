# Billing webhook API tests return HTTP 400 with signature/metadata errors

## Summary
The Jest suite for the billing webhook endpoint (`__tests__/api/billing/webhook.test.ts`) consistently fails. All mocked webhook deliveries receive HTTP 400 responses and log repeated complaints about invalid Stripe signatures and missing metadata. These errors began surfacing in the latest `npm test` run (67 suites, 15 failing) and affect every scenario in the webhook suite.

## Impact
- Prevents verification of our Stripe billing webhook handler logic.
- Blocks confidence in subscription lifecycle flows (checkout completion, invoice payment, cancellation, etc.).
- Introduces risk of regressions reaching production without automated coverage.

## Affected tests
- `__tests__/api/billing/webhook.test.ts`
- Downstream integration expectations in `__tests__/integration/billing-flow.test.ts` that depend on webhook side-effects.

## Steps to reproduce
1. Install dependencies (`npm install`).
2. Run the test suite: `npm test -- __tests__/api/billing/webhook.test.ts`.
3. Observe HTTP 400 responses and repeated log output about signature validation or missing metadata in every case.

## Expected behaviour
- Each mocked webhook request should be validated, processed, and return HTTP 200.
- Tests should confirm correct branching logic (subscription created, updated, cancelled, invoice paid, etc.).

## Actual behaviour
- Handler immediately exits with HTTP 400 for all events.
- Logs complain about invalid Stripe signatures and absent metadata, preventing the assertions from running.

## Proposed next steps
- Audit the webhook handler to confirm which headers/body fields it expects during verification.
- Update the tests to supply a correctly signed payload (potentially by using the Stripe CLI utility for generating signatures or by adjusting mocks to align with handler requirements).
- Ensure the mocked event payloads include any metadata keys referenced by the handler.
- Add assertions that confirm a `200` status and correct side-effect behaviour once validation passes.

## Additional context
- This failure category was one of the major contributors to the 90 failed assertions during the latest `npm test` execution.
- Addressing the signature validation mismatch should unblock several other billing-related suites.
