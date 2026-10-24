# PR307 review fixes — October 24, 2026

Updates the existing `prime/tiers` PR. No merge, deployment, remote database write or Stripe object change was performed.

## Fixes

1. **Terms:** approved D-044 feature and price copy; October 24 date. Refund and no-auto-renew wording preserved.
2. **Price transition:** optional comma-separated `STRIPE_PRICE_PMLE_PASS_LEGACY` accepts old paid checkouts. Unknown paid PMLE prices log fixed, data-free text and return retryable 503; webhook processing stays incomplete for recovery. Ownership/payment/refund validation stays enforced. New checkouts use only the current price.
3. **Mock history:** one server access preflight and one service-only bulk RPC for the latest 50 owned attempts. Expired attempts finalize in bulk. Access is rechecked after lock waits and before return. Active scores stay hidden.
4. **Practice focus:** store only the server-selected reason and domain atomically with the owned session. Rebuild canonical labels on load/resume. Ignore `?focus=` and reject stored prose or invalid metadata.
5. **Replay:** mock tables/indexes use `IF NOT EXISTS`; remove the redundant session-only item index. Local full migration replay preserves rows, functions, RLS and grants.
6. **Revenue:** absent/invalid Stripe amount or currency omits both revenue and currency. Real discounted and zero totals remain valid.

## Local database evidence

Both amended migrations replayed successfully on the isolated `testero-v2` local database. Before and after counts: 39 study sessions, 0 mock sessions, 0 mock items. See `migration-before.log`, `migration1-replay.log`, `migration2-replay.log` and `migration-after.log`.

The clean-env DB suite passed (`db.log`). It includes replay metadata inside the rollback-only replay transaction, latest-50 history/ownership/scoring, queued lock deadline and revocation races, exact stored focus metadata and malformed/cross-domain rejection, plus existing billing/refund/free-practice checks. Isolated fixtures were removed.

## Final gates

All commands below used `env -i PATH="$PATH" HOME="$HOME" CI=true`.

| Command | Result | Log |
| --- | --- | --- |
| `npm test` | PASS — 105 files, 1,914 tests | `unit-final.log` |
| `npm run lint` | PASS | `lint-final.log` |
| `npm run typecheck` | PASS | `typecheck-final.log` |
| `npm run build` | PASS | `build-final.log` |
| `docker build .` | PASS | `docker-build-final.log` |
| `npm run test:db:local` | PASS | `db.log` |
| `npm run test:e2e:local` | PASS — 20 passed, 16 existing skips | `e2e.log` |

Docker retains the existing `SecretsUsedInArgOrEnv` warning for the placeholder `SUPABASE_SERVICE_ROLE_KEY` in the Dockerfile; no real credential was supplied. Earlier failed runs are archived outside the repo. The initial full unit run found two expected configuration lists missing the new legacy-price variable; both lists were updated before the final run. An initial new test type annotation was also fixed.

Browser verification completed with 20 passed and 16 existing skips (3.9 minutes). It checks exact stored focus metadata and canonical text, ignores forged focus URLs across reload/resume, and retains the three history/diagnostic/general fallback flows. The 162 E2E/test/fixture/configuration inputs in `e2e-test-sources.sha256` matched before and after the run. `source-hashes.json` records frozen application, test, fixture, migration and configuration inputs; their hashes also still match.

Source commits: `61f362d` (billing), `a11a48c` (mock history/replay), `a9ce300` (stored focus), `c697386` (terms/revenue). The final evidence/docs commit follows these source commits. Runtime-generated `next-env.d.ts` dev paths were restored after the browser server stopped; no generated file is included in this fix.

Live Stripe and cloud behavior were not tested. Billing tests use the existing fake Stripe transport or mocks. The coordinator still owns production migrations and price configuration.
