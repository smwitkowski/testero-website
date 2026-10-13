# PR: v2: restore trustworthy product analytics

Base: `main`; head: `prime/analytics-fix`. Do not merge without founder approval: merging deploys production.

## Summary
- Enable PostHog session replay with all inputs and DOM text masked (including account email), while autocapture stays off.
- Persist anonymous identity with `localStorage+cookie`; retain `identified_only` profiles. Identify only server-verified user UUIDs after login/signup and reset on successful sign-out.
- Emit `diagnostic_question_answered` after a successful save, with only `session_id`, `ordinal` (1–20), and `domain_code`. The progress API exposes only the safe domain code in addition to its prior question fields.
- Capture successful diagnostic start/completion, confirmed signup, and checkout creation on the server via PostHog HTTP capture. Next `after()` schedules capture after response with a 1-second timeout, and failures never change the response. No dependencies or env variables added.
- Forward the browser distinct ID on diagnostic/checkout requests; otherwise use the diagnostic session ID or verified account ID. Headers are bounded to 200 alphanumeric/underscore/hyphen characters. Telemetry headers never authorize access.
- Server events include `source: server`. Stable server insert IDs dedupe diagnostic retries, repeat signup callbacks by verified account ID, and checkout retries by hashed checkout ID. Browser/server insert IDs are separate so a browser copy cannot drop the server copy. Use `source = server` for canonical funnel counts; keep existing browser events only for comparison.
- App `next.config.ts` and `proxy.ts` have no CSP, so recorder scripts and ingestion are not blocked by an app allowlist. Any external proxy CSP must be checked after deploy.

## Verification after founder-approved deploy
1. Use a non-blocking browser with PostHog enabled. Open `/diagnostic`, reload, and confirm `$pageview` events keep one anonymous distinct ID.
2. Start and complete a diagnostic. In PostHog Activity/Events, check `diagnostic_started` and `diagnostic_completed` with `source: server`, `session_id`, and the browser `distinct_id`. Count these server events once per session. Also verify with browser ingestion blocked: the server completion should still appear, using the session ID when no client ID is supplied.
3. Check 20 `diagnostic_question_answered` events with the same `session_id`, ordinals 1–20, and `domain_code`. No answer text, label, correctness, or explanations may appear in event properties. Failed saves must not emit the event.
4. Confirm a signup email. Check `signup_completed` with `source: server`; generic signup form submission and failed confirmation must not count. Sign in and verify PostHog identifies the server-verified account UUID, with no email/password/token traits. Sign out and verify the next visit has a fresh anonymous identity.
5. Start PMLE Pass checkout from a free verified account. Check `checkout_started` with `source: server`, `plan_name: PMLE Pass`, and the browser distinct ID. Already-active accounts and failed checkout must not emit this event.
6. Open PostHog **Session replay → Recordings** and find the new browsing session (project replay must be enabled). Confirm interactions are visible but input values, passwords, account email, question/answer text, and explanations are masked. Network-blocked browsers may not produce recordings.
7. Compare server completions with DB `study_sessions.completed_at` counts over the same post-deploy window. This change is bounded best-effort delivery, not an outbox: outages/process loss can still drop captures; no automatic retry is introduced.

## Local gates
Passed in order with `env -i PATH="$PATH" HOME="$HOME" CI=true`: `npm test` (44 files, 825 tests), `npm run lint`, `npm run typecheck`, then `docker build -t testero-analytics-check .` (exit 0).

Docker emitted its existing `SecretsUsedInArgOrEnv` warning for the `SUPABASE_SERVICE_ROLE_KEY` placeholder; no real key was supplied. Runtime dependencies remain 15; no package/lock or env changes. Local mocks are not live PostHog validation.

## Publication
PR publication is blocked by the current developer instruction prohibiting git push and remote services. This document is the ready-to-paste PR description.
