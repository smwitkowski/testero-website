# Paid diagnostic landing verification — 2026-10-23

## Design

Use `https://testero.ai/diagnostic?length=5&src=ad&utm_source=google&utm_medium=cpc&utm_campaign=pmle-test-oct` for Google Search. Google can append `gclid` normally. For Reddit, keep `src=ad` and change the campaign's existing UTM source/content values. This variant keeps the primary action above the length controls, with longer checks in a native disclosure.

The manual CTA does not wait for saved-session lookup. The lookup stays owner-scoped and can offer **Continue where I left off**. Starting manually aborts and invalidates older lookup results. Errors do not block a new check. No session is created by a page GET. The existing POST, httpOnly owner cookie and atomic account claims remain the authority.

Legacy `?start=1` still waits before automatically creating a session, so revisiting that URL cannot replace an unfinished run. Its manual CTA is available while it waits. The ad should use the explicit-action URL above rather than legacy autostart.

## Measurement method

Baseline source: `8231d73` (the branch base). Both sides use the same pinned dependencies, a warmed local optimized Next build, a fresh browser context for each run, a 1280×812 or 375×812 viewport, and CDP Fast 4G (4 Mbps down, 3 Mbps up, 20 ms latency; no CPU throttling). Three runs per viewport. All app/database traffic is loopback-only. These are local measurements, not claims about live Cloud Run or Supabase latency.

`enabled` records the first visible enabled button; static HTML alone is insufficient. `interactive` additionally requires the enabled button's hydrated React `onClick`. The browser tests separately click the CTA while the resume request is unresolved and verify the real POST and first question.

A second matched scenario holds the saved-progress GET for exactly 5,000 ms. This synthetic delay isolates the dependency that blocked paid visitors; it is not a measurement of production.

Reproduce with a local optimized server on port 3002:

```sh
MEASURE_ORIGIN=http://127.0.0.1:3002 MEASURE_MODE="local production build, route warmed, cold browser context each run" node scripts/measure-ad-landing.mjs after-production
MEASURE_ORIGIN=http://127.0.0.1:3002 MEASURE_MODE="local production build, route warmed, cold browser context each run" RESUME_DELAY_MS=5000 node scripts/measure-ad-landing.mjs after-production-slow-resume
node scripts/capture-ad-landing.mjs
```

The capture script checks the local v2 endpoints, creates only local anonymous sessions, captures fresh/question/returning states, verifies return to question 2 and deletes the exact sessions it created.

## Accepted copy changes

- Start action moves directly under the short title and original-question subhead. Remove the metric tiles and blocking saved-progress status. Rename length choices and resume/new-check actions.
- Questions show concise right/wrong feedback and a length-aware explanation promise; beta remains readiness-tier-only.
- Five-question results use a quick-check title and rough-pointer caveat. Keep one **Keep going** section, one free full explanation, clear free-account value, and accurate PMLE Pass/refund copy.
- Paid-intent auth copy includes the 7-day refund. Existing non-PMLE availability and paid boundaries remain unchanged.

## Results

Median navigation-to-hydrated-enabled-CTA time (three cold-context runs each):

| Scenario | Width | Before | After |
| --- | ---: | ---: | ---: |
| Local resume API | 1280 | 986 ms | 967 ms |
| Local resume API | 375 | 994 ms | 960 ms |
| Synthetic 5,000 ms resume API hold | 1280 | 5,988 ms | 982 ms |
| Synthetic 5,000 ms resume API hold | 375 | 5,974 ms | 972 ms |

The normal local API was already fast, so this is not a claim of a large network speedup. The fix removes the resume API from the manual start path and fixes the mobile layout. Under the delayed API scenario, after-run times range from 963–1,045 ms. The original development-mode baseline was 2.76–3.91 s; it is stored separately and is not mixed into the optimized-build comparison.

In the full-font screenshot capture at height 812, fresh CTA top is 302.5 px desktop / 330 px mobile. The returning **Continue where I left off** top is 387.5 px desktop / 435 px mobile. All controls fit in the viewport. Both returning cases reopen question 2 with saved answers.

### Screenshots

| State | Desktop | 375 px mobile |
| --- | --- | --- |
| Fresh | [Desktop](screenshots/fresh-1280.png) | [Mobile](screenshots/fresh-375.png) |
| Returning, unfinished | [Desktop](screenshots/returning-1280.png) | [Mobile](screenshots/returning-375.png) |
| First question | [Desktop](screenshots/question-1280.png) | [Mobile](screenshots/question-375.png) |

## Attribution: existing versus added

Existing `posthog-js@1.435.8` already captures campaign params including `gclid`. Executing its installed persistence and session-property code proves current event `utm_*`/`gclid`, person `$initial_utm_*`/`$initial_gclid`, and `$session_entry_utm_*`/`$session_entry_gclid`. Session-entry attribution changes at a new session, not mid-session. With `person_profiles: "identified_only"`, person processing waits for identify. Existing login/confirmed-signup components already call `posthog.identify(userId)`; login/logout boundaries remain intact.

The server helper previously had only a browser header/fallback ID and no campaign fields. Confirmation requests have no custom browser header. Purchase events used an unrelated purchase-hash distinct ID, lacked `source=server`, and had no revenue.

Added:

- Bounded first-party 90-day first-touch cookie with exactly `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `gclid`. No full URLs, referrers, emails or auth tokens are stored. Cookie values are untrusted telemetry, never authorization.
- Synchronous landing capture before a diagnostic/signup/checkout request can leave, plus a tagged anonymous/identified SDK-ID cookie for confirmation requests. Browser exclusions still prevent internal/bot initialization.
- Verified signup links only anonymous-tagged browser IDs to the verified account. Client identify and server `$identify` preserve first-touch person properties with `$set_once`; another identified account is never server-merged.
- First-touch fields on server `diagnostic_started`, `diagnostic_completed`, `signup_completed`, `checkout_started`, `purchase_completed`. Already-verified account identity wins over a stale client ID for authenticated diagnostic/signup/checkout paths.
- Allowlisted campaign/exclusion metadata persists on the server-created Stripe Checkout Session, so verified webhook/return fulfillment uses the same account and first touch without webhook cookies. Metadata cannot override server ownership. A stable user/price/ten-minute-window key prevents attribution changes from creating a second payable checkout. If Stripe reports an idempotency parameter conflict, the server reuses a matching open checkout for that verified customer; the original checkout metadata remains unchanged.
- Purchase `revenue` is a number in dollars from the verified Stripe `amount_total / 100`, with uppercase `currency`; tests prove `39` / `USD`. Invalid or missing payment values are omitted. Purchase capture runs after the response, remains best effort, and cannot change entitlement fulfillment.

Coordinator-provided prior PostHog observation: server `diagnostic_started` had 27% `utm_source` coverage, versus 84% on client `diagnostic_question_answered`. Local tests now prove field propagation through all five server funnel events, identity linking and verified purchase revenue. **No live post-change coverage or ROAS is claimed:** this branch has not been deployed, and live ingestion was not contacted.

### Verification and limits

- `env -i PATH="$PATH" HOME="$HOME" CI=true npm test`: 95 files / 1,758 tests passed.
- Clean-env `npm run lint` and `npm run typecheck`: passed.
- Historical matched full-suite before the review fixes, clean-env `npm run test:e2e:local`: **19 passed / 16 existing opt-in skips / 0 failed** on PR `1024acd`; clean `origin/main` baseline: **14 passed / 16 skipped / 0 failed**. All three previously timed-out cases pass on both. See [the per-test baseline comparison](baseline-comparison.md). This is the fresh Next dev full suite; optimized-build coverage remains separate below.
- Final optimized local paid-flow suite: **5/5passed**, including desktop/mobile slow lookup, returning owned question2, failed lookup manual start and exact Google ad-checker UA no-autostart/manual-click. Returning setup uses real browser interactions so the httpOnly Secure cookie follows the normal browser path instead of plain-HTTP APIRequestContext behavior.
- Optimized local build passed. Final frozen-source `docker build .` passed (image `sha256:20b914428afba5578a968bf87c67df57e8f3e474a2fe542648161f20d2a218a8`). Docker reports the existing placeholder `SUPABASE_SERVICE_ROLE_KEY` ENV-name warning; no real key is passed to the image build.
- Independent read-only review of the three review fixes found no blocking issue. Checkout conflict recovery, account UUID rejection and organic-to-ad attribution regression tests pass. See [review-fixes.md](review-fixes.md).

Browser run history: the first full run passed 18 / skipped 16. Later runs had a practice-summary loading timeout, then broad framework HTML404 responses, then 15 passed / 16 skipped / 3 auth/practice timeouts after clearing `.next`. Those outcomes remain recorded in `browser-run-history.txt`, `e2e-rerun-note.json`, `local-routing-cache-note.json` and `gates.json`. On the coordinator-requested matched baseline follow-up, all three cases passed on main and the unchanged PR branch; the latest full PR suite is green at 19 passed / 16 skipped. No auth/practice runtime code or timeout was changed. The historical failures are not proven pre-existing on main; they did not reproduce in this paired run. See `baseline-comparison.md` for exact setup, modes, commit IDs and per-test durations.

The final ad-crawler follow-up adds `Google-AdWords-Express`, `AdsBot-Google` (including Mobile), `Google-Ads` and `Mediapartners-Google` to the same client/server/checkout exclusion predicate. The legacy `start=1` effect also checks this predicate before automatic POST, independently of whether analytics is configured. Exact supplied final-URL checker UA tests prove no automatic creation; manual clicks still work. Page GETs remain mutation-free.

All test data and services were local. No merge, deploy, new third-party script, production write, database migration or live Stripe/PostHog proof was performed. Direct runtime dependencies remain unchanged.

Cookies blocked or confirmation opened on a different device can prevent anonymous-history linking. Telemetry IDs/campaigns can be spoofed. Legacy checkouts without the collection marker intentionally emit no purchase capture. Analytics remains best effort; a crash after the durable purchase capture claim can lose an event. Server first-touch fields do not manufacture a browser `$session_id`.

Timing application-source commit: `166a05a9622e9878cd70c91604c9b806494d157b`. Timing raw data and `timing-summary.json` use that optimized build for after measurements. The later `c16d6c5` crawler-only guard/exclusion follow-up does not change normal-visitor layout; its optimized build and exact-UA browser test are checked separately.

## Review fixes

Applied all three requested fixes in application source `5fb0dc1`: stable user/price/window checkout key plus safe original open-session reuse on Stripe parameter conflict; no server identify for account-shaped browser IDs; and no empty first-touch cookie on organic/invalid visits, including recovery from legacy empty cookies. The first valid campaign and original checkout metadata remain unchanged.

Clean-env units (95 files / 1,758 tests), lint, typecheck, optimized build and Docker pass on that source. The optimized local five-case paid-landing suite also passes. The historical matched full-suite comparison above is not a post-fix full-suite result. See [review-fixes.md](review-fixes.md) and [review-fixes.json](review-fixes.json) for commands, limits and the final image hash. No layout changed; timing artifacts still describe the earlier explicitly named source snapshot.
