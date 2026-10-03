# Testero v2 working rules

Read `../hq/v2-spec.md` and D-014, D-017, D-019 in `../hq/decisions.md` first.
Work on `prime/v2`. Phase 1 covers the foundation, Supabase SSR, anonymous
diagnostic, results, and analytics. Do not add account UI, practice, billing,
marketing migrations, or old app features before their phase.

## Safety

- Read no `.env*` file except `.env.example`. The example contains placeholders.
- Run Supabase and browser tests against loopback URLs only. Get generated local
  keys from `supabase status -o json` into process environment, never logs or files.
- No Supabase `link`, `db push`, `--linked`, `--project-ref`, remote secrets, or
  function deployments. Use `supabase start` and `supabase db reset --local`.
- No real Stripe, PostHog, production Supabase, cloud deploy, `gcloud`, `gh`, or
  git push during local Phase 1 work.
- Preserve `content-pipeline/` exactly, `content/`, public brand assets,
  `supabase/migrations_legacy/`, and `docs/deployment/stripe-setup.md`.
- Never use the old `database.types.ts`. Generate only from the local v2 schema.

## Architecture and checks

Keep all product code in TypeScript. Use Next App Router, Tailwind 4, and only
shadcn components that the app uses. Use local system fonts. Keep at most 25 direct
runtime dependencies; one worker owns package installation and the lockfile.

Port verified selection, shuffle, readiness, copy, and paid-access logic rather
than inventing replacements. Money, access, auth, scoring, and selection need unit
tests. No marketing tests. Keep one local anonymous-diagnostic Playwright smoke.
Anonymous result responses contain score, readiness tier, and domain breakdown;
never question review, correctness labels, or explanations.

Run through this package's native environment:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:db:local
npm run test:e2e:local
```

Tests require local generated credentials; builds use loopback placeholders and
empty PostHog values. Use `npm run dev:local` for manual development.
`scripts/local.mjs` loads local status keys into process environment only, rejects
non-`testero-v2` configs and non-loopback API/DB ports 56541/56542, and keeps PostHog
empty. It never reads or writes `.env` files. Playwright uses `e2e/`, localhost:3000,
and no server reuse. In a second terminal, `PLAYWRIGHT_MANAGED_SERVER=1 npm run
test:e2e:local` reuses the managed local server; omit that flag to let Playwright
start its own server. See README for the placeholder-only build command.

## Shared worktree

Keep commits small. Commit messages start with `v2:`. Use `git commit --only --`
with an explicit list of your owned paths; never commit a peer's staged work.
Report files, interfaces, check results, commit hash, and blockers to the parent.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
