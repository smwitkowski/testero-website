# Testero v2

A small PMLE readiness app. This branch builds Phase 1 of the fresh app in
[`../hq/v2-spec.md`](../hq/v2-spec.md). Anonymous users take a 20-question diagnostic
and see their score, readiness tier, and domain breakdown. Question review,
accounts, practice, and billing are later phases. No marketing-page test suite.

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
```

The reset is **local only** and destroys the local database. It applies the v2
baseline and seed, not `supabase/migrations_legacy/`. Never use `link`, `--linked`,
`--project-ref`, a remote database URL, or `db push` for local work.

`.env.example` lists placeholder values, not working credentials. A local runner
must read `supabase status -o json` and supply its generated local API URL, anon
key, and service-role key through the child process environment. Do not print,
commit, or copy real credentials into documentation. Keep
`NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` empty locally. Do not use
production Supabase, Stripe, or PostHog for tests.

```sh
npm run dev
```

The app listens on `http://127.0.0.1:3000`. Supply the same local process environment
when running the diagnostic smoke test. Placeholder credentials cannot run it.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs Vitest's pure server-logic units in Node. It excludes the content
pipeline, legacy migrations, and browser tests. Playwright runs `e2e/` in Chromium
against localhost and rejects a non-loopback Supabase URL. Its default web server
is `npm run dev`, with `reuseExistingServer: false`. Set
`PLAYWRIGHT_MANAGED_SERVER=1` only when a local runner already owns port 3000.

The build does not need a running database. Supply loopback placeholder Supabase
values and an empty PostHog key; do not put a real service-role key in image builds.
`npm run runtimebuild` is an alias for `npm run build`. `npm start` runs a built app.

Count direct runtime dependencies:

```sh
node -p 'Object.keys(require("./package.json").dependencies).length'
```

## Deployment configuration

Next emits standalone output. The Node 22 multi-stage Dockerfile runs as a non-root
user. Public Supabase and optional PostHog values are build arguments; the
service-role key is runtime-only. The workflow runs lint, typecheck, unit tests,
and build for PRs. Only a push to `main` builds/pushes an image and deploys to the
existing Cloud Run service. No cloud deployment is part of local Phase 1 checks.

## Preserved material

- `content-pipeline/` is a separate tool and is unchanged by this rebuild.
- `content/` keeps existing posts and FAQ source for the later content phase.
- `public/` keeps brand assets.
- `supabase/migrations_legacy/` keeps the historical SQL, excluded from replay.
- `docs/deployment/stripe-setup.md` is retained for the later billing phase.

Business decisions live in `../hq/decisions.md`: D-014 ($39 PMLE Pass for 90 days),
D-017 (anonymous results only; no question review), and D-019 (fresh minimal app).
