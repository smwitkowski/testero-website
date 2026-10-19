# D-039: monthly free practice and paid score tracking

## Allowance

Free confirmed accounts reserve up to five questions at session creation, capped at the remaining monthly allowance. A session can start with one question left. Reserved questions count even if unanswered or the session expires (24 hours). The UTC calendar-month bucket resets at 00:00 on the first. The conditional upsert and snapshot insertion run in one transaction; failed snapshots roll back the charge. Concurrent stale requests can be refused when their selected length no longer fits; the browser asks to reload the actual remaining allowance rather than claiming it is exhausted.

The limit changed from 5/week to 60/month; the session maximum stays 5. Migration `20261019000000_monthly_free_practice.sql` renames the bucket and sums stored weekly usage by the UTC month containing its week start. Historical weekly counters cannot reconstruct question timestamps across a month boundary; this preserves recorded usage without inventing event data. No production migration has been applied by this worker.

## Tracking inventory and access boundary

- Dashboard: latest diagnostic score, readiness tier, domain breakdown, weakest-domain guidance, report link. These remain free as the latest diagnostic report, explicitly required by D-039. There is no combined practice accuracy, historical list or trend chart today.
- Practice summary: overall score, correct count, readiness/domain aggregate fields in the API; score and correct count rendered in the UI. These require a fresh paid-access check. Free payloads omit aggregate fields server-side, while retaining the owned answer review (right/wrong and correct answer). Paid users retain all previous fields and explanations.
- Practice in progress: ordinal, answered count, owned resume link and per-answer correctness are operational session state, not historical performance tracking; these remain free.
- Diagnostic results and its existing one-question free explanation preview are unchanged. All practice explanations remain paid, including retries and summaries after refund/expiry.

Paid copy calls the current tracking benefit score tracking for each practice session; no new history or trend feature is promised. Free dashboard/summary uses a single locked teaser rather than repeated interruption.

## Editorial originals

No original blog file contains a five-free-practice-questions/week offer. Hash-locked blog originals are unchanged. Similar five/week search hits describe study schedules, not the product allowance.

## Local verification artifacts

The header fetches verified identity separately from the dashboard. On both this branch and unchanged `origin/main`, login/reload can render the dashboard heading while the header still shows its initial signed-out state; the successful navigation response then renders Dashboard/Account. Screenshot capture now asserts the settled desktop and mobile header identity, not just the dashboard heading. No persistent stale header was reproduced and no auth behavior was changed.

Focused e2e: `e2e/free-tier-monthly.spec.ts`; screenshots: `test-results/free-tier-monthly/*-{1280,390}.png`. QA and Stripe transport are local fixtures, not evidence of live Stripe validation.
