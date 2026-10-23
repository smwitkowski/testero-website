# PR 305 review fixes — 2026-10-23

## Changes

1. Checkout idempotency hashes only the verified user, configured price, and ten-minute window. The route captures the clock once for both key and recovery. On an actual `StripeIdempotencyError`, the adapter lists the verified customer's open sessions in that window, follows pagination, and rechecks user/product/customer/mode/payment status/price/quantity and the existing URL allowlist. It returns a matching original session without changing its metadata. No match or lookup failure fails closed; unrelated create errors are not recovered, and no alternative key or retry-create is used.
2. Server signup identification rejects UUID-shaped browser IDs even when the writable cookie tags one as anonymous. The verified-account `signup_completed` event still emits. This is a conservative shape guard, not verification of arbitrary anonymous IDs.
3. Organic or invalid-tag visits do not write an empty first-touch cookie. Legacy sanitized-empty cookies can be replaced by the first valid campaign. A valid saved campaign remains unchanged on later visits.

## Regression tests

- `tests/billing-checkout-idempotency.test.ts`: route plus real adapter, mocked Stripe SDK. The storage simulation throws the actual SDK error on differing parameters with one key, then counts one physical simulated session across requests with differing attribution/exclusion cookies. It asserts the same URL, stable key, original metadata, telemetry dedupe, normal replay, clock-boundary handling, pagination, unsafe candidate rejection and failed recovery.
- `tests/attribution.test.ts`: anonymous-tagged account UUID produces no `$identify`, while signup still emits with the verified account; ordinary anonymous linking stays covered. Organic/invalid → tagged → later-tagged visits and legacy-empty-cookie recovery are covered.
- `tests/billing-checkout.test.ts`: the exact key contains only user/price/window; user, price and window changes remain distinct.

These are local/mock regression tests, not live Stripe evidence. Parallel create visibility is not tested. A conflict with no visible safe open session returns the existing sanitized billing error rather than creating another session.

## Independent review

The separate read-only reviewer found no blocking issue in the frozen changes. It confirmed exact SDK error matching, fail-closed recovery, session ownership/product/window/URL guards, account UUID rejection and empty-cookie behavior. It also noted the mocked-Stripe and concurrent-visibility limits above.

## Verification

Verified application source: `5fb0dc187cdb89a235a72a5dc98037ad836ab5ae`. All results below were inspected after command completion.

- `env -i PATH="$PATH" HOME="$HOME" CI=true npm test`: **95 files / 1,758 tests passed**.
- `env -i PATH="$PATH" HOME="$HOME" CI=true npm run lint`: exit 0.
- `env -i PATH="$PATH" HOME="$HOME" CI=true npm run typecheck`: exit 0.
- Clean-env `npm run build` with loopback Supabase URL, explicit non-secret build placeholders, and empty PostHog configuration: exit 0. The whole generated `.next` was cleared before this build, after confirming no local test server/fixture was listening.
- `env -i PATH="$PATH" HOME="$HOME" CI=true docker build .`: exit 0; image `sha256:20b914428afba5578a968bf87c67df57e8f3e474a2fe542648161f20d2a218a8`. Existing Docker ENV-name warning remains; its value is a placeholder, not a real key.
- Final optimized local paid-landing suite: **5 passed / 0 failed**, 9.6 seconds. Desktop/mobile held lookup, returning owned question 2, failed lookup manual start and exact Google ad-checker no-autostart/manual-click all pass. See `optimized-paid-browser-output.txt`.

The optimized paid command used the existing ignored local launcher:

```sh
env -i PATH="$PATH" HOME="$HOME" CI=true node .qa/ad-landing/run-local-check.mjs e2e/paid-landing.spec.ts --config=.qa/ad-landing/playwright-optimized.config.mjs
```

That launcher obtains only the validated loopback v2 Supabase configuration from `supabase status -o json` in process memory and invokes `npx playwright test`. The config imports the normal project Playwright config, keeps its one worker/zero retries/desktop Chrome settings, and changes only the managed server to `npm run start -- --port 3000`, with no server reuse and blank public PostHog settings. No Stripe fixture or real Stripe key is used by these five landing-only cases. Next emits its existing standalone-output/`next start` warning; the optimized server started and all five cases passed.

Historical matched main/PR **full-suite** evidence remains in `baseline-comparison.md` at main `8231d73` and PR `1024acd`. It predates these review fixes and is not presented as a new full-suite run. This review task reran the requested optimized paid suite, not the entire development browser suite.

No `.env` files were read or written. No live Stripe/PostHog request, production write, merge or deploy occurred. Direct runtime dependencies remain unchanged.
