# Testero v2

Independent PMLE readiness and practice. Not affiliated with Google.
Start with a free, anonymous 20-question diagnostic. A confirmed account saves
results and includes 5 practice questions per week (Monday 00:00 UTC reset).
PMLE Pass is $39 USD once for 90 days: explanations and unlimited 5-question
sessions, no auto-renew, 7-day refund window. A refund ends paid access.

## Run locally

Node 22, npm, Docker/Colima and Supabase CLI are required.

```sh
npm ci
supabase start
supabase db reset --local  # destroys ONLY the local v2 database
npm run dev:local
```

App: http://127.0.0.1:3000. Local Supabase API/DB: 56541/56542;
Studio: 56543; Mailpit: 56544; fake Stripe fixture: 56545.
`scripts/local.mjs` loads generated local keys into child process memory only.
It rejects other projects/ports, disables PostHog, and uses fake Stripe over
loopback. It never reads or writes credential files. Never use production services
or Supabase `link`, `db push`, `--linked`, or `--project-ref` for local checks.
Read only `.env.example`, not actual `.env` files. Leave frozen preview port 3100 alone.

## Check

```sh
npm run lint
npm run typecheck
npm test
npm run test:db:local
npx playwright install chromium
npm run test:e2e:local
```

The three browser flows cover anonymous diagnostic; confirmed auth/claim/free
practice/recovery; and signed local pass payment/refund/replay/legacy access.
Omit `PLAYWRIGHT_MANAGED_SERVER` to let tests own their server. Set it to `1` only
when `dev:local` already owns port 3000. Stop dev before a build (shared `.next`).

Build without credentials or a database:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56541 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key-placeholder \
SUPABASE_SERVICE_ROLE_KEY=local-service-role-key-placeholder \
NEXT_PUBLIC_POSTHOG_KEY= NEXT_PUBLIC_POSTHOG_HOST= NEXT_TELEMETRY_DISABLED=1 \
npm run build
```

`npm start` serves a build; Docker uses Next standalone output and copies runtime
Markdown. System fonts require no external requests. There are at most 25 direct
runtime dependencies. `content-pipeline/` remains a separate, unchanged tool.

## Content and release

Original blog sources stay byte-identical. Public posts use hash-locked, clearly
marked editorial Markdown overlays that remove unsupported claims. FAQ answers
retain citations. All 390 old sitemap URLs render or permanently redirect.
Only `content/legal/{terms,privacy}.md` with literal `approved: true` publishes
legal text. Otherwise pages say **being finalized**. Never publish `hq/drafts`.

Business truth: `../hq/v2-spec.md`, `../hq/business.md`, and decisions D-014,
D-017, D-019. No invented statistics, testimonials, pass guarantees or hours saved.

- [Launch checklist](docs/launch-checklist.md): human approval and cutover gates.
- [Runtime setup](docs/deployment/v2-runtime.md): GitHub/Cloud Run/Secret Manager.
- [Stripe setup](docs/deployment/stripe-setup.md): product, webhook and test-mode QA.
- [Phase 4 proof](docs/v2-phase4-verification.md): measured local evidence.

PR checks run lint/types/units/build. A push to `main` builds an image and deploys
with merged environment and secret bindings. Private keys are runtime-only.
Daily/manual keep-alive checks public `/api/health` for HTTP 200 and `{ok:true}`.
No remote migration, push, PR creation or deployment is part of this local work.
