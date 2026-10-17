# Question transition timing

Investigation base: `c03d091`. No application timer was found or removed. The reported production 810–820ms delay was not reproduced locally. This PR changes test measurement and regression coverage, not application performance.

## Observations

Local mirrored bank: 142 ACTIVE questions, loopback Supabase, Next development server, Chromium, desktop1280/mobile375. Local PostHog is disabled; production SDK/main-thread behavior remains unverified. Production recently moved to Cloud Run us-east4 (user supplied); Supabase region is unknown. These local measurements do not verify cloud placement or cross-region RTT.

Before test changes, six real diagnostic UI answers per viewport recorded browser timestamps. Desktop first answer included cold compilation: click→DOM1062.2ms, JSON consumed→DOM2.1ms. Remaining desktop answers: click→DOM44.0–53.3ms, JSON consumed→DOM1.7–2.0ms. Mobile all six: click→DOM41.4–55.7ms, JSON consumed→DOM1.7–2.4ms. External Playwright measurements for the warm answers were110.4–127.7ms, not browser render time. Start click→DOM was98.4ms desktop/101.0ms mobile; assertion elapsed176.2/180ms. These are development observations, not production guarantees or a controlled application speedup.

An initial practice observer incorrectly treated “Saving your answer…” as feedback. Its external answer timings are invalid and excluded. Committed-feedback records available for four answers per viewport were2.3–3.1ms after JSON consumption; the corrected observer and final regression runs require actual “Correct answer:” feedback. Corrected after-run paid feedback (n5 per viewport) was2.4–3.0ms desktop and2.5–3.1ms mobile after JSON consumption. Raw artifacts remain in coordinator status for audit.

## Before/after (same application code)

Diagnostic answer click→DOM p50, excluding the first answer in each run/viewport for consistent warm samples (n5 each). These differences are run noise, not a shipped speedup.

| Viewport | Before test changes | After test changes |
| --- | ---: | ---: |
| qa-1280 | 47.0ms | 45.6ms |
| qa-375 | 42.9ms | 42.8ms |

Baseline `npm run qa:local`:6 passed. After, with diagnostic UI and corrected observer scenarios added to the temporary harness:12 passed. No application code differs between these runs.

## Regression boundary

Existing diagnostic and free-practice browser flows now measure with a small browser-clock observer, not the return time of a retrying visibility assertion. New questions require the expected ordinal, four enabled radios, visible heading geometry, and heading focus. Feedback requires committed answer JSON, four disabled radios and actual answer feedback, never a pending status. This is DOM-ready evidence, not physical display/paint proof.

The diagnostic client budget is the sum of click→POST start, answer JSON consumed→progress GET start, and progress JSON consumed→focused DOM. It excludes network waits and JSON parsing. Practice feedback includes click→POST start and JSON consumed→feedback DOM. Next uses click→focused DOM when prefetch is ready, or excludes only the subsequent progress fetch duration when fallback is needed. Artificially held prefetch remains covered by the existing stale-response test but is not a performance sample. Each client budget is strictly below150ms. RSC start remains a separate whole-journey smoke: streaming response end is not a safe client-render anchor.

Temporary800ms mutations before diagnostic reload and after progress JSON both failed the new assertion (820.2ms and816.3ms, respectively; exit1). Both mutations were restored. No runtime constants changed. The150ms value is a test regression budget, not a new application delay.

## Reproduction

Use the existing local diagnostic/accounts-practice flows through `npm run test:e2e:local`. The separate QA250 harness was a temporary uncommitted overlay for mirrored-bank before/after `npm run qa:local` validation; this PR does not depend on it. No production writes or infrastructure changes were made.
