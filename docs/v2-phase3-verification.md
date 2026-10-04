# Phase 3 verification — PMLE Pass billing and paid features

Verified locally on 2026-10-03 on `prime/v2` in `frontend.prime-testero-code`.
Phase 2 remains accepted. Frozen `frontend.v2-preview` and port 3100 were untouched.

## Route table

| Routes | State |
| --- | --- |
| `/pricing` | Real PMLE Pass offer: US $39 one-time, 90 days, no auto-renew, 7-day refund. Signed-out CTA preserves `next=/pricing`. |
| `/checkout/success` | Protected, owned-checkout status only. Processing until an actual webhook grant; no redirect/cookie grant. |
| `/account` | Protected, fresh pass expiry/legacy/free/error status, legacy-only portal, logout. |
| `/dashboard` | Real readiness, domains, resume, free quota and fresh paid status. |
| `/diagnostic` and session/results routes | Real. Anonymous aggregate-only; completed signed-in review; fresh paid explanations only. No feedback during the diagnostic. |
| `/practice/[id]` and summary | Real. Free five/week; paid unlimited five-question sessions. Fresh paid answer/summary explanations; refund redacts subsequent responses. |
| Signup/login/forgot/reset and `/auth/confirm` | Real verified email/password auth and cookie-hash claims, unchanged Phase 2 behavior. |
| `/api/billing/checkout` POST | Verified account, server-configured price, payment mode, cards, idempotency key. Existing paid access returns `/account`; verification error blocks charging. |
| `/api/billing/portal` POST | Verified active legacy subscriber's owned customer only. |
| `/api/billing/status` GET | Shared fresh access check plus owned checkout row; processing/active/refunded/expired, no grant or Stripe retrieval. |
| `/api/billing/webhook` POST | Raw-body SDK signature verification, configured paid checkout, current payment state, service-only idempotent grant/refund/receipt RPCs. Excluded from browser auth proxy. |
| Auth/diagnostic/practice APIs | Real protected ownership boundaries and private/no-store responses. |
| `/`, `/blog`, `/blog/[slug]`, `/faq`, `/faq/[slug]`, `/terms`, `/privacy` | Phase 4 stubs. Existing five blog and nine FAQ URLs retained; unapproved legal drafts not published. |

## Executed gates

- `npm run lint`, `npm run typecheck`: pass, no warnings.
- `npm test`: **712 tests across 33 files**, pass. Stripe and analytics mocked;
  auth, configured price, duplicate-charge prevention, raw signature rejection,
  replay/refund, all access states/errors, paid redaction and quota bypass covered.
- `npm run build`: pass with loopback placeholder Supabase/Stripe environment
  and empty PostHog. No dev/build race and no database or Stripe calls required.
- `supabase db reset --local`: fresh isolated `testero-v2` baseline and seed pass.
- `npm run test:db:local`: all **eight integration groups** pass. Includes eight-way
  fulfillment/receipt/refund races, refund-first and grant-first, immutable replay,
  receipt owner/amount/currency mismatch denial, and exact 2160-hour expiry across
  DST. Browser roles cannot execute receipt/grant/refund functions.
- `npm run test:e2e:local`: **three actual Chromium tests** pass. Original anonymous
  diagnostic and Phase 2 auth/practice/recovery remain green. Paid flow uses the
  real Stripe SDK against a loopback HTTP fixture and locally signed payloads:
  verified account → exhaust free quota → real pricing CTA → processing without
  grant → signed completion → paid review/answer explanations → multiple extra
  sessions without free-counter charge → refund → replay cannot restore access →
  redaction and 429 → active legacy portal and quota bypass.
- Browser also checks an invalid signature, anonymous checkout rejection,
  idempotent checkout reuse, pass-holder duplicate-charge and portal denial,
  honest owned status, refund receipt state, and 90 × 24-hour access duration.
- Pricing, paid account, paid diagnostic review, answered practice and refunded
  dashboard checked at **320 and 1280 pixels**. No horizontal overflow, page errors
  or external browser requests. `/tmp/testero-v2-phase3-visual/` holds screenshots.
- Measured product code: **3,802 TS/TSX/CSS lines across 98 files**, including
  `proxy.ts`; excludes tests, generated files, local fixture tooling, SQL, content
  and pipeline. Baseline SQL: **562 lines**. **14 runtime dependencies**, none added.
- Protected `prime/pmle-pass` and `prime/testero-code` refs unchanged. Pipeline
  tree remains `4f8deb4f336bfff9a11ba7732ebe322b42c1ecfb`, identical to the port source.

## Source anchors

- `lib/billing/paid-access.ts:44`: one fresh server access rule; any source error
  denies both sources, including when another source could otherwise grant.
- `app/api/billing/checkout/route.ts:10`: ten-minute idempotency key; `:20` avoids
  charging already-paid accounts.
- `app/api/billing/webhook/route.ts:16`: raw SDK signature; `:38` reviewed grant
  port; `:41` atomic receipt; `:54` durable refund.
- `app/api/billing/status/route.ts:13`: shared checker, not a second access rule.
- `lib/billing/explanations.ts:21`: server-only snapshot-text mapping, not shuffled
  letters; missing/changed/ambiguous content fails closed.
- `lib/practice/service.ts:46` / `:106`: fresh creation and answered-feedback access.
- `supabase/migrations/20261003000000_v2_baseline.sql:316` / `:332`: receipt/refund
  status shares the payment-intent lock, so a late completion cannot undo a refund.
- `e2e/billing.spec.ts:16` / `:52`: actual paid flow and locally signed webhook.
- `.github/workflows/deploy-to-cloud-run.yml:103`: server-runtime Stripe secrets.
- `docs/deployment/stripe-setup.md:8`: founder setup and events.

## Founder setup and boundaries

Follow `docs/deployment/stripe-setup.md`. Create PMLE Pass with one-time USD $39
price, matching test-mode key and price ID. Configure
`https://<app-host>/api/billing/webhook` for `checkout.session.completed`,
`charge.refunded`, `customer.subscription.updated`, `customer.subscription.deleted`.
Set GitHub secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_PMLE_PASS` plus existing Supabase/GCP secrets. Configure legacy
customer portal. Review/apply the additive baseline through the approved release
process, then founder-operated Stripe test-mode QA. Do not deploy local test values.

All executed work used local Supabase only. The local runner injects test-only
Stripe values and starts/reuses fixture port 56545. Transport requires the exact
local flag/key, non-production mode and local Supabase port 56541. Invalid or
production fixture/placeholder configurations fail before SDK calls. No `.env`
credential files, real Stripe/PostHog/email calls, push or deploy were used.

## Spec gaps and decisions

No Phase 3 blocker remains. Decisions not explicit in the brief:
- Existing active legacy subscribers also skip a new charge and go to account.
- Unlimited means unlimited five-question sessions, not a new variable-length API.
- Card-only checkout; async completion is handled defensively but not required.
- Idempotency uses ten-minute windows; retries within the window reuse checkout.
- Refund policy is founder-operated, and any actual partial/full refund revokes.
- Paid permission is rechecked in the database at creation. If permission changes
  during that request, the current free quota applies or returns 429.
- A receipt failure retries the webhook; the already-verified pass may exist before
  the receipt retry completes. No access is inferred from receipt status.
- Analytics is best-effort, with an opaque stable insert hash for deduplication;
  server delivery was mocked/disabled locally, not tested against PostHog.

Founder must supply the actual matching price/keys/signing secret, approve legal
pages and production configuration, and perform remote test-mode QA before launch.
Those external steps were not executed. Phase 4 remains pending.
