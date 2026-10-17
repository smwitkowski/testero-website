# Local production-bank QA

Run `npm run qa:local` from this worktree with Docker, Supabase CLI, Node 22,
gcloud and Playwright Chromium installed. Do not run concurrently with another
local testero-v2 DB/app user. It starts Supabase, applies pending local migrations (never resets), imports the cached ACTIVE bank,
seeds local accounts, and runs the QA suite at 1280 and 375 pixels. Playwright
starts/stops its own app; Supabase remains running. No production writes occur.

The first run needs read access to Secret Manager version 1 of
`testero-supabase-service-role` in `testero-ai`. The secret stays in memory.
Only questions, answers, explanations and referenced domains are read by REST.
No production account or billing data is fetched. REST redirects are rejected;
all writes require the loopback API on port 56541. Relation queries paginate.
Run `npm run qa:local -- --refresh` to refresh `.qa/bank.json`.

`.qa/` is excluded from git and Docker. It contains content cache, deterministic
local-only fixture passwords in `accounts.json`, and `report.json`. Do not copy
these files to deployment. Accounts are free, paid, refunded and unconfirmed.
Paid/refunded access uses the same database RPCs as billing, with fake local IDs.
Repeated seeds preserve accounts but reset only those four owned fixture users’
sessions, free quota and pass rows, so paid access stays fresh. Unrelated local
users and their history are untouched. Missing exported questions are marked
RETIRED locally, not deleted, preserving historical session references.

The QA suite reuses existing confirmation-email, claim-ownership, five-question
quota, signed fake Stripe grant/refund and content-gating flows. The focused UI
flow checks explanations appear once, next navigation, summary, and overflow.
Diagnostic click-to-visible-question must be <=2000ms after explicit real-session
route compilation warmup; diagnostic and practice answer durations attach to
Playwright output and the per-viewport report. The warmup does not mock or cache
the measured session API. Never call fixture results live Stripe
validation. Traces and timings are under `test-results/`; short status is `.qa/report.json`.

A restored database can have extra required columns or unique constraints not
present in the fresh migration baseline. The mirror fails closed on incompatible
schemas; it never resets a database or applies migrations. Existing production-
schema verification is separate (`node scripts/local.mjs e2e:prod`) and its fixed
inventory assertions are not used as mirror inventory counts.
