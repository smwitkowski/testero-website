# Phase 2 verification — accounts and practice

Verified locally on 2026-10-03 in `frontend.prime-testero-code`, branch `prime/v2`.
Scope: [`v2-spec.md`](../../hq/v2-spec.md), Phase 2. No remote database, deployment,
payment, email provider, or analytics service was used.

## Results and routes

| Routes | State |
| --- | --- |
| `/diagnostic`, `/diagnostic/[sessionId]`, `/diagnostic/[sessionId]/results` | Real anonymous and signed-in diagnostics. Anonymous results are aggregate-only; completed account-owned results add review without explanations. |
| `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/auth/confirm` | Real confirmed email/password Auth. Local mail confirmation and recovery execute through Mailpit. |
| `/dashboard` | Protected; idempotent cookie-hash claim, latest readiness, six domains, weakest two CTAs, genuine empty/error states, actual free quota and owned resume. |
| `/practice/[id]`, `/practice/[id]/summary` | Protected; five-question domain session, committed feedback, score and review without explanations. |
| `/account` | Real protection and logout; Phase 3 access-status placeholder remains. Header Account link makes logout discoverable. |
| `/api/auth/{signup,login,logout,forgot-password,reset-password}` | Real POST handlers; generic identity-sensitive responses, same-origin writes and private/no-store. |
| `/api/diagnostic`, `/api/diagnostic/[sessionId]`, `/answer`, `/results` | Real owned diagnostic API; no correctness during the diagnostic. |
| `/api/practice`, `/api/practice/[id]`, `/answer`, `/summary` | Real verified-account API. Exhaustion is 429 with `/pricing`; no paid or legacy fallback. |
| `/pricing`, `/checkout/success` | Phase 3 stubs, no payment success claims. |
| `/`, `/blog`, `/blog/[slug]`, `/faq`, `/faq/[slug]`, `/terms`, `/privacy` | Phase 4 stubs. Existing five blog and nine FAQ slugs remain. Legal drafts are not published. |

## Executed evidence

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm test`: **511 tests, 24 files**, pass. Auth, ownership, access, selection,
  scoring, feedback privacy, quota failures, dashboard and mocked analytics.
- `npm run build`: pass with loopback placeholder Supabase values and empty
  PostHog values. No database required. Root dev was stopped before build.
- `supabase start` and `supabase db reset --local`: pass, local `testero-v2` only.
- `npm run test:db:local`: all **seven integration groups**, pass. Includes
  eight concurrent five-question creations with exactly one success/charge;
  rollback; strict cap despite pass/refund/legacy rows; hash-only bulk claims,
  replay, concurrent ownership, old-cookie denial and restrictive RLS.
- `npm run test:e2e:local`: **two real Chromium tests**, pass. Anonymous twenty
  questions; signup → Mailpit confirmation → owned diagnostic claim/review →
  dashboard → five practice answers/summary → 429 exhaustion → upgrade stub.
  Also login/logout, identical known/unknown recovery response, Mailpit recovery,
  password update and successful login with the new password. Isolated test
  users and sessions are deleted in `finally`.
- Dashboard/practice/summary checked at **320 and 1280 pixels**, with no horizontal
  overflow or browser errors. No external browser requests. Screenshots:
  `/tmp/testero-v2-phase2-visual/`.
- Measured product code: **3,028 TS/TSX/CSS lines across 85 files**, including
  `proxy.ts`; excludes tests, generated files, SQL, preserved content and pipeline.
  Baseline SQL: **529 lines**. Direct runtime dependencies: **14**, none added.
- `git diff --check`: pass. Pipeline tree and protected refs unchanged from
  `prime/pmle-pass` / `prime/testero-code`. The frozen Phase 1 preview and its
  port 3100 process were not changed or stopped.

Logs (local, not credentials):
`/tmp/testero-v2-phase2-native-final.log`,
`/tmp/testero-v2-phase2-build-ultimate.log`,
`/tmp/testero-v2-phase2-db-final.log`,
`/tmp/testero-v2-phase2-playwright-ultimate.log`.

## Implementation anchors

- `lib/auth/session.ts:10`: confirmed server `getUser` is the identity gate.
- `lib/auth/redirects.ts:2`: safe local next paths; rejects paths whose dot
  segments normalize to a protocol-relative external destination.
- `lib/auth/claim.ts:8`: hashes the actual visitor cookie; no session-ID claim.
- `supabase/migrations/20261003000000_v2_baseline.sql:339`: atomic free quota.
- Same baseline `:444` / `:452`: service-only strict free creation and bulk claims.
- `lib/practice/service.ts:22`: feedback/review fail closed on malformed snapshots.
- Same service `:56` / `:63`: strict free RPC and kind/owner boundary before data.
- `lib/dashboard/service.ts:9`: account-owned reads and deterministic weakest two.
- `lib/diagnostic/service.ts:104`: completed account-only review whitelist.
- `e2e/accounts-practice.spec.ts:46`: executed Auth/claim/practice/recovery journey.
- `README.md:17`: local startup and checks, without credential files.

## Decisions and remaining scope

Details not fixed by the spec: weeks start Monday at 00:00 UTC; all five questions
are reserved atomically at creation; sessions expire after 24 hours; claims attach
all still-anonymous visitor-owned diagnostics, including completed/expired ones;
dashboard retries claims idempotently. Passwords are 8–72 characters. Phase 2 uses
the strict free-only RPC even when a legacy/pass row exists; preserved paid rules
remain for Phase 3. No account IDs or emails are sent with signup analytics.
Analytics was tested with a mocked SDK and disabled in the live local tests.

No blocking Phase 2 question remains. Phase 3 implements billing, paid access
status and explanations. Phase 4 implements launch content/legal approval and
production configuration. The baseline has not been applied remotely.

Use `npm run dev:local` on port 3000 to review Phase 2; local Supabase is already
running. Leave the accepted frozen preview on port 3100 alone.
