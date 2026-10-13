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

## Safety

- Read no `.env*` except `.env.example`. Never print, write or commit credentials.
- No prod database writes and no `supabase db push`, `link` or `--project-ref`
  against prod. Migrations go in `supabase/migrations/` and the coordinator
  applies them after merge.
- Local dev uses `scripts/local.mjs` (local Supabase, fake Stripe transport).
- Preserve `content-pipeline/` (active question generator) and the original
  blog blobs used by hash-locked editorial versions.
- Stay at <=25 direct runtime dependencies.

## Architecture

Next App Router/TypeScript, Tailwind 4, used shadcn components, system fonts.
Supabase SSR verifies `getUser` plus confirmed email; httpOnly cookie hashes
bind anonymous diagnostics and atomic account claims. Anonymous results are
aggregate-only. Free review has no explanations. All explanations require fresh,
fail-closed paid access on the server. The database rechecks paid/free quota at
session creation. Stripe signed webhooks alone grant passes; refund tombstones
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
