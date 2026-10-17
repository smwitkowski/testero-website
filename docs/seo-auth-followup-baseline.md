# PR241 local auth baseline comparison

## Baseline

- Clean detached `f9c73a4` (requested origin/main baseline).
- Command: `npm run test:e2e:local`; unchanged suite, one Chromium worker, retries zero.
- Shared existing loopback Supabase; no restart or config changes.
- Lockfile byte-identical to current branch. Symlinked dependencies were rejected by Turbopack before tests; copied existing dependencies locally and reran unchanged command.
- Completed: exit 1, **2 failed / 2 passed**, 48.2 seconds.
- Worktree was moved after completion to avoid Next build cleanup, then removed at coordinator request so TypeScript/lint cannot traverse it. Only the report and sanitized logs are preserved.

## Exact reproduced failures

1. `e2e/accounts-practice.spec.ts:48`: assertion at line 110 expected dashboard; received `/login?message=confirmation-failed`.
2. `e2e/auth-email.spec.ts:45`: assertion at line 30 expected `next=/dashboard`; received null.

Billing and anonymous diagnostic tests passed.

## Sanitized command output

```text
npm run test:e2e:local
Running 4 tests using 1 worker
FAIL e2e/accounts-practice.spec.ts:48
  Expected pattern: /\/dashboard(?:\?.*)?$/
  Received: http://127.0.0.1:3000/login?message=confirmation-failed
  at e2e/accounts-practice.spec.ts:110:24
FAIL e2e/auth-email.spec.ts:45
  Expected: "/dashboard"
  Received: null
  at e2e/auth-email.spec.ts:30:52
PASS e2e/billing.spec.ts:18
PASS e2e/diagnostic.spec.ts:21
2 failed, 2 passed (48.2s)
exit 1
```

## Root cause evidence

Fresh baseline signup mail at 2026-10-16T15:37:48Z and 15:37:55Z contains a loopback `/auth/confirm` link with decoded parameter names `token_hash`, `type`, `redirect_to`. `type` is `signup`; `next` is absent. The redirect destination's pathname is `/auth/confirm`. No token, email address, or actual complete href is reproduced here.

HTML uses single `&amp;` separators, not `&amp;amp;`. Both the test's single entity replacement and a normal HTML decode produce the same keys. This is **not a double-escaping/parsing defect**.

Checked-in `supabase/templates/confirmation.html` instead generates `token_hash`, `type=signup`, `next=/dashboard`; recovery generates `next=/reset-password`. Running local auth therefore uses a different/stale template than this checkout. Exact container template provenance was not inspected or changed.

`lib/auth/validation.ts` uses a strict confirmation schema that excludes `redirect_to`. Thus the emitted link is rejected before OTP verification and routes to confirmation-failed; the other test directly detects missing `next`.

## Attribution and suggested fix

The exact two failures reproduce on clean `f9c73a4`; **PR241 did not introduce them**. Baseline/current diffs are empty for both auth tests, templates, validation, confirmation route, local runner, and Playwright config.

Recommended next action: obtain approval to reload/restart the shared local Supabase auth service with checked-in templates; inspect newly emitted safe parameter shape, then rerun both baseline and branch sequentially. Do not weaken the strict confirmation schema or change test HTML parsing to accommodate stale local template output. Hosted/cloud template state is unverified.

## Artifacts

Sanitized stdout is retained in the worker status artifacts (`seo-followup/auth-baseline.log`); the relevant output is reproduced above. Temporary baseline worktree and logs under the source worktree were removed. Raw Playwright traces were removed with the owned baseline worktree; no traces are published.
