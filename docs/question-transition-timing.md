# Question transition timing

## What changed

Diagnostic answer POST now returns updated safe progress: counts, completion status and the next question, never correctness or explanations. The client renders this response directly instead of issuing a progress GET. Practice answer POST similarly returns safe progress with its committed feedback; Next consumes that progress synchronously. A second rapid Next is a no-op, not a fallback GET. Retry still reloads saved state.

The existing answer RPC remains the atomic commit and idempotency boundary. No migration is needed. After commit, the server reads items using the already-authorized session. Outer counts and nested progress come from that single item snapshot; a read behind the RPC count fails closed, while a concurrent later answer may legitimately advance it. This removes a browser HTTP round trip, not every database read. Practice reuses its postcommit item read for feedback and progress. Paid access is freshly read after commit, and explanation loading remains fail-closed and gated. Anonymous diagnostic answers never contain feedback/explanations.

Creation now overlaps independent owner-history and eligible-inventory reads. Preference ranking waits for both, preserving new/unseen selection and pagination. No cache, auth bypass or query limit was added. The no-session Supabase SDK already avoids an auth network call; anonymous credentials measured0.3ms locally, so auth was not established as the production bottleneck.

## Timing visibility

Diagnostic create and answer, plus practice answer, emit numeric request-local `Server-Timing` spans on success and errors. Fixed metric names contain no owner IDs, hashes, cookies, content or query values. Create spans: credentials (verified getUser), owner_hash, history, inventory, selection (overlapping total), snapshot, create_rpc, total. Answer spans: credentials, ownership, answer_rpc, progress_read; practice also paid_access. Overlapping spans must not be summed. Total starts in the route, excluding proxy/queue/TLS time.

## Mirrored local evidence

Bank142 ACTIVE questions, loopback Supabase, Next development server, Chromium desktop1280/mobile375. Three new anonymous starts and nine real UI answers per viewport per run. Browser timestamps measure expected-question DOM readiness, not physical paint or Playwright assertion retry duration. Production PostHog is disabled locally. Cloud Run us-east4 is user supplied; Supabase region and cloud RTT are unverified.

Baseline used instrumentation only before behavior changes:8 QA scenarios passed. Updated run includes the existing diagnostic UI scenario as well as free-practice and fake-Stripe paid/refund flows. Initial updated attempt was stopped after an outdated pending-button test label failed; a subsequent attempt failed because that cancellation left our own local Next listener. Its worktree was verified and it was stopped before the final run. Neither attempt is reported as a pass.

All values are p50 milliseconds. Starts n3, answers n9 per viewport; same bank and development interface, separate sequential runs. Small samples and run noise limit attribution.

| Measure | Desktop before→after | Mobile before→after |
| --- | ---: | ---: |
| Create API response end | 39.3→30.7 | 37.5→31.8 |
| Start click→question DOM | 98.4→77.9 | 88.2→81.9 |
| Answer click→next DOM | 50.8→28.5 | 46.8→31.3 |
| Answer fetch start→JSON consumed | 24.9→26.6 | 22.0→29.2 |

All18 baseline answers issued one follow-up progress GET; all18 updated answers issued zero. Added postcommit server item-read p50:5.0ms desktop/5.4ms mobile. Answer POST itself therefore need not be faster: the browser avoids the second request and its repeated ownership lookup.

Create route total p50:32.1→24.7ms desktop/30.3→24.9ms mobile; history6.8→5.5/5.3→6.7ms; selection12.8→12.3/13.4→13.7ms; create RPC10.2→8.5/11.9→9.1ms; credentials0.3→0.3/0.3→0.2ms. Baseline selection includes inventory+CPU; updated selection includes overlapping preference wait and inventory is separately instrumented. These span definitions must not be treated as identical inventory measurements. The observed total reduction is consistent with overlap but includes RPC/run noise; it does not locate the production1.8s bottleneck.

Final mirrored QA:10/10 passed (94.3s), including diagnostic UI, free practice, paid explanation/refund and both viewports.


## Regression boundary

A browser-clock helper requires the expected ordinal, four enabled radios, heading geometry and heading focus for a new question. Feedback requires consumed answer JSON, four disabled radios and committed “Correct answer:” text, never “Saving your answer…”. Diagnostic/feedback client budget is click→POST start plus answer JSON consumed→DOM/focus, strictly below150ms; network waits and JSON parsing are excluded. Next uses click→DOM/focus and requires neither POST nor GET. Causal timestamp order is asserted; negative intervals cannot cancel other work. Existing diagnostic and practice flows assert no follow-up progress GET. The first practice answer is held after commit to prove pending Next is absent; rapid double Next then proves it advances once without any GET.

Historical pre-change800ms mutations caught pre-reload820.2ms and post-progress-JSON816.3ms; those reload paths are now removed. Current single-response800ms post-answer-JSON mutation failed the client budget at813.3ms (exit1); it was restored before the final focused pass. No800ms timer was found or removed. The150ms constant is a regression budget, not an application delay or a whole-request SLA.

## Production model, not a measurement

User trace: create POST1793ms TTFB, RSC76ms, visible2352ms; answer POST291ms then progress GET235ms, visible833ms. Removing the browser GET saves235ms only before accounting for the added postcommit item read inside POST and other changes. With all else equal, modeled answer visibility is `598ms + added item-read latency + other deltas`, not a measured production result or a guaranteed sub150ms journey. Creation overlap can save roughly the smaller of history and inventory latency, not explain or eliminate the whole1793ms. Production Server-Timing is needed to locate that remaining cost.

## Verification and open questions

Use existing `npm run test:e2e:local` flows. The mirrored QA250 harness was a temporary overlay only; no package/config/harness dependency is committed. Clean environment verification:1040 tests/55 files, lint and typecheck passed. Docker build also passed (exit0). No production writes, infrastructure changes or migration were made. Supabase confirmed-user verification, owner binding, quota checks, RPC idempotency and refund redaction remain in place.

Pre-existing access-expiry semantics remain: the access query is fresh after commit, but its comparison time is captured at request start. Expiry during a long commit is a separate follow-up, not newly fixed here. Live production SDK/main-thread and cloud timing remain unverified.
