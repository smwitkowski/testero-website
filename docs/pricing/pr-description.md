## Migrations — apply before deployment

1. `supabase/migrations/20261024000000_unlimited_free_practice.sql`
2. `supabase/migrations/20261024100000_pmle_mock_exams.sql`

Applied only to loopback local PostgreSQL by this worker. The coordinator applies these in production and separately configures the $39.99 Stripe price behind `STRIPE_PRICE_PMLE_PASS`. No Stripe objects, production data or cloud resources were changed. **Do not merge or deploy without founder approval.**

## What changed

**Free:** unlimited practice, correct-answer feedback, per-domain progress and recent practice scores. No monthly quota. Existing diagnostic and ChatGPT free explanations are unchanged; other explanations stay paid.

**PMLE Pass:** $39.99 one-time for 90 days, 7-day refund, no auto-renew. Adds resumable 50-question / 120-minute mocks with domain scores and full explanation review, fresh-first practice, and one-click weak-area drills. Variants stay Pass-only.

- Mock deadline and scoring are database-enforced. No answer keys or explanations are sent during a mock. Unanswered questions score incorrect.
- Selection exhausts owned unanswered question IDs before seen fallback. Blueprint shortfalls and repeats are disclosed rather than failing the exam.
- Drills require five distinct answered questions per domain, otherwise use the latest diagnostic focus or an explicitly named general fallback.
- One configured/display price source; revenue uses Stripe's actual `amount_total / 100`, with configured fallback.
- Live bank-size claims count active approved originals only. No “unlimited questions” or promised future bank size.
- Service-only RPC grants/RLS, paid revocation checks, paginated history/bank reads and mobile navigator regression coverage.

## Verification

All gates used a clean environment: `env -i PATH="$PATH" HOME="$HOME" CI=true`.

- `npm test`: **1,833 passed across 103 files**.
- `npm run lint`, `npm run typecheck`, `npm run build`, `docker build .`: **passed**.
- `npm run test:e2e:local`: **20 passed, 16 pre-existing conditional skips**. Required D-044 scenarios all ran, including actual signup + 65 answered free questions, mocks, fresh-first and weak drills.
- `npm run test:db:local`: **all groups passed**, including native row-lock deadline/revocation races and paid RPC checks.
- Independent source review completed; all in-scope findings fixed. Real 1280 px / 375 px screenshots visually checked.

[Full verification](https://github.com/smwitkowski/testero-website/blob/prime/tiers/docs/pricing/verification.md) · [machine evidence](https://github.com/smwitkowski/testero-website/blob/prime/tiers/docs/pricing/verification.json) · [tier handoff](https://github.com/smwitkowski/testero-website/blob/prime/tiers/docs/pricing/pmle-pass-tiers.md)

## Screenshots

<details>
<summary>Pricing — 1280 px and 375 px</summary>

![Pricing desktop](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/pricing-1280.png)

![Pricing mobile](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/pricing-375.png)

</details>

<details>
<summary>Free practice dashboard — 1280 px and 375 px</summary>

![Free practice dashboard desktop](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/dashboard-free-1280.png)

![Free practice dashboard mobile](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/dashboard-free-375.png)

</details>

<details>
<summary>Pass practice dashboard — 1280 px and 375 px</summary>

![Pass practice dashboard desktop](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/dashboard-paid-1280.png)

![Pass practice dashboard mobile](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/dashboard-paid-375.png)

</details>

<details>
<summary>Mock in progress — 1280 px and 375 px</summary>

![Mock in progress desktop](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/mock-in-progress-1280.png)

![Mock in progress mobile](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/mock-in-progress-375.png)

</details>

<details>
<summary>Mock results — 1280 px and 375 px</summary>

![Mock results desktop](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/mock-results-1280.png)

![Mock results mobile](https://raw.githubusercontent.com/smwitkowski/testero-website/prime/tiers/docs/pricing/screenshots/mock-results-375.png)

</details>

## Scope and known limits

No feature was descoped. Mock expiry is enforced on every database interaction; if a browser closes, its next authenticated interaction finalizes the expired attempt at the original deadline. There is no background cron requirement.

The standard browser suite has pre-existing opt-in beta/cached-production audit skips; required D-044 signup, >60 practice, locked-feature, mock, fresh-first and weak-drill scenarios run. Existing dependency audit advisories and Dockerfile placeholder-key lint warning were not changed by this pricing task.
