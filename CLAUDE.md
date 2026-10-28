# Testero working rules

v2 is live on testero.ai (D-023). Business context and decisions live in
`../hq/` (business.md, decisions.md, operating-plan.md); read the relevant
decisions before product changes. Agents may read `hq/` including
`hq/drafts`, but never publish `hq/drafts` content to the site.

## Workflow

- Work on a feature branch (`prime/<name>` or `chore/<name>`), push it and open
  a PR against `main`. Never merge: merging to `main` auto-deploys to prod and
  needs founder approval (D-005).
- Keep commits small, with explicit owned paths.
- One worker per worktree; never edit another worktree.
- This repo is public. Evidence (logs, screenshots, verification JSON, PR
  text, handoffs) goes in the PR body or `../hq/drafts/<task>/evidence/`,
  never in the repo. Commit only minimal test fixtures, never batch or
  calibration artifacts.

## Safety

- Read no `.env*` except `.env.example`. Never print, write or commit credentials.
- No prod database writes and no `supabase db push`, `link` or `--project-ref`
  against prod. Migrations go in `supabase/migrations/` and the coordinator
  applies them after merge.
- Local dev uses `scripts/local.mjs` (local Supabase, fake Stripe transport).
- Preserve `content-pipeline/` (active question generator) and the original
  blog blobs used by hash-locked editorial versions.
- Stay at <=25 direct runtime dependencies.

## Shared local resources

Local Supabase and port 3000 are shared by every worktree. Before `qa:local`,
`test:db:local`, `test:e2e:local`, `supabase db reset --local` or a server on
:3000, take the lease in the foreground:
`until mkdir ~/.cache/testero-qa-lease 2>/dev/null; do sleep 120; done; echo <worker> > ~/.cache/testero-qa-lease/owner`.
Release it (`rm -rf ~/.cache/testero-qa-lease`) as soon as the run ends. Never
end your turn while holding it, and never stop a process you didn't start.
Checks that don't need the database use a production build on another port
(for example 3102) and no lease. Don't negotiate the lease with other workers;
if it's held for long, ask the coordinator under Open questions.

## Architecture

Next App Router/TypeScript, Tailwind 4, used shadcn components, system fonts.
Supabase SSR verifies `getUser` plus confirmed email; httpOnly cookie hashes
bind anonymous diagnostics and atomic account claims. Anonymous results are
aggregate-only. One completed, owned diagnostic item has a free explanation via
the dedicated server-selected preview path. All other explanations require fresh,
fail-closed paid access on the server. The database rechecks paid/free quota at
session creation. Stripe signed webhooks and authenticated server-verified checkout returns grant passes; refund tombstones
and payment-intent locks beat replay and out-of-order receipt writes.

Public content is local Markdown rendered as safe React nodes, never raw HTML.
Explicit hash-locked editorial versions remove prohibited claims. Legal body
requires literal `approved: true` in the two `content/legal` files.
No testimonials, invented statistics, pass guarantees or hours-saved claims.
Keep independent/not affiliated with Google positioning.

## Verification

Run in a clean env before finishing: `env -i PATH="$PATH" HOME="$HOME" CI=true
npm test`, `npm run lint`, `npm run typecheck`, and `docker build .`. Use
`npm run test:db:local` / `npm run test:e2e:local` when touching DB or flows.
Do not infer live Stripe/cloud validation from fixtures. Generate database
types from local v2 only.

- Fresh worktree: run `npm ci` before any gate.
- `content-pipeline/` is Python: `cd content-pipeline && env -i PATH="$PATH"
  HOME="$HOME" uv run pytest -q`. The repo root is the Node app; pytest there
  fails.
- Run browser suites (`qa:local`, `test:e2e:local`) against a production build
  or after `rm -rf .next`; the dev route cache goes stale and serves framework
  404s.
- Known load-sensitive timeouts: account/billing and auth/practice e2e. Before
  calling a failure pre-existing, run the same command on a clean `origin/main`
  worktree and put both outputs in the PR.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
