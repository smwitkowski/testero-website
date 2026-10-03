# Testero v2

A small PMLE readiness app. This branch implements Phases 1 and 2 of the fresh app
in [`../hq/v2-spec.md`](../hq/v2-spec.md). Anonymous users take a 20-question
diagnostic and see score, readiness tier, and domains. Confirmed email/password
accounts claim their own anonymous diagnostics, see question review, and practice
five questions per week. Billing, paid explanations, and launch content remain
later phases. No marketing-page test suite.

## Stack

Node 22, npm, Next.js App Router, React, TypeScript, Tailwind 4, and the shadcn
Button/Card components. Supabase provides the local database and Auth wiring.
PostHog is optional and disabled when its public key is empty. System fonts require
no external font fetch. Runtime dependencies must stay at or below 25.

## Local development only

Install Colima (or Docker), the Supabase CLI, and Node 22. From this folder:

```sh
npm ci
colima start --cpu 4 --memory 8
supabase start
supabase db reset --local
npm run dev:local
```

The local API is `http://127.0.0.1:56541`; PostgreSQL listens on
`127.0.0.1:56542`. Studio uses port 56543 and local mail uses port 56544.
The reset is **local only** and destroys the local database. It applies the v2
baseline and seed, not `supabase/migrations_legacy/`. Never use `link`, `--linked`,
`--project-ref`, a remote database URL, or `db push` for local work.

`.env.example` lists placeholders, not working credentials. `scripts/local.mjs`
reads generated keys from `supabase status -o json` into the child process
environment only. It reads or writes no `.env` files. It rejects a Supabase config
other than `testero-v2` and API/database endpoints outside loopback ports
56541/56542. It keeps PostHog empty. Do not print or commit credentials. Do not use
production Supabase, Stripe, or PostHog for tests.

The app listens on `http://127.0.0.1:3000`. Leave `npm run dev:local` running for
manual use. Placeholder credentials cannot run diagnostics, auth, or practice.
Signup and password recovery emails stay in local Mailpit at
`http://127.0.0.1:56544`. Open its confirmation link to finish signup.

Dashboard, practice, summaries, and account require a confirmed Supabase user.
Claims use the visitor's httpOnly anonymous cookie hash, never a supplied session
ID. Free practice reserves all five questions in one database transaction at
session creation. The allowance resets Monday at 00:00 UTC. Resume an unfinished
session from the dashboard; new sessions expire after 24 hours. Reviews include
selected and correct answers, but no explanations. Phase 2 always uses the strict
free-only RPC, even for existing pass or legacy subscription rows.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:db:local
npx playwright install chromium
npm run test:e2e:local
```

Run the browser tests in a new terminal. If `npm run dev:local` is already running,
use `PLAYWRIGHT_MANAGED_SERVER=1 npm run test:e2e:local`. Otherwise the smoke test
starts and stops its own local Playwright web server. The two tests cover the
anonymous diagnostic and signup, Mailpit confirmation, owned claim/review,
five-question practice, quota exhaustion, login/logout, and password recovery.
They create and delete isolated local test users and sessions.

`npm test` runs Vitest's pure server-logic units in Node. It excludes the content
pipeline, legacy migrations, and browser tests. Playwright runs `e2e/` in Chromium
against localhost and rejects a non-loopback Supabase URL. Its default web server
is `npm run dev`, with `reuseExistingServer: false`. Set
`PLAYWRIGHT_MANAGED_SERVER=1` only when a local runner already owns port 3000.

The build does not need a running database. Use loopback placeholders:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56541 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key-placeholder \
SUPABASE_SERVICE_ROLE_KEY=local-service-role-key-placeholder \
NEXT_PUBLIC_POSTHOG_KEY= NEXT_PUBLIC_POSTHOG_HOST= NEXT_TELEMETRY_DISABLED=1 \
npm run build
```

Do not put a real service-role key in image builds. `npm run runtimebuild` is an
alias for `npm run build`. `npm start` runs a built app.

Count direct runtime dependencies:

```sh
node -p 'Object.keys(require("./package.json").dependencies).length'
```

## Deployment configuration

Next emits standalone output. The Node 22 multi-stage Dockerfile runs as a non-root
user. Public Supabase and optional PostHog values are build arguments; the
service-role key is runtime-only. The workflow runs lint, typecheck, unit tests,
and build for PRs. Only a push to `main` builds/pushes an image and deploys to the
existing Cloud Run service. No cloud deployment is part of local Phase 1 or 2 checks.

## Preserved material

- `content-pipeline/` is a separate tool and is unchanged by this rebuild.
- `content/` keeps existing posts and FAQ source for the later content phase.
- `public/` keeps brand assets.
- `supabase/migrations_legacy/` keeps the historical SQL, excluded from replay.
- `docs/deployment/stripe-setup.md` is retained for the later billing phase.

Business decisions live in `../hq/decisions.md`: D-014 ($39 PMLE Pass for 90 days),
D-017 (anonymous results only; no question review), and D-019 (fresh minimal app).

## Click-through preview

Public billing, content, and legal routes remain clearly marked Phase 3/4 stubs.
They never present sample account data or successful payments as real. Terms and
Privacy are "being finalized" placeholders, not the unapproved drafts. Blog and
FAQ links keep the five and nine preserved URL slugs. The account route retains
its Phase 3 access-status placeholder, but has real protection and logout.

The accepted Phase 1 founder preview remains frozen in a separate worktree on
port 3100. Do not restart it or start `.claude/launch.json`'s `v2-dev` while it
owns that port. Use `npm run dev:local` on port 3000 for Phase 2. It injects the
generated local keys without any credential file. Only verified Supabase account
state switches the header from Sign in to Dashboard; an anonymous diagnostic
cookie does not.
