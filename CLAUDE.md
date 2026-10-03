# Testero v2 working rules

Read `../hq/v2-spec.md`, `../hq/business.md`, and decisions D-014, D-017,
D-019 first. Work on `prime/v2`; Phases 1–4 implement the fresh app.

## Safety

- Preserve `content-pipeline/`, original blog blobs and archived migrations.
- Never touch main `frontend` or frozen `frontend.v2-preview` / port 3100.
- Read no `.env*` except `.env.example`. Never print, write or commit credentials.
- Local Supabase only: project `testero-v2`, API 56541, DB 56542. No `link`,
  `db push`, `--linked`, `--project-ref`, remote services, cloud calls or git push.
- Use `scripts/local.mjs` for generated credentials in child memory and fake
  Stripe SDK transport on 56545. PostHog stays disabled locally.
- Use root dev port 3000. One owner runs DB/build/dev; stop dev before build.
- Keep commits small, `v2:` prefix, explicit owned paths with `git commit --only`.

## Architecture

Next App Router/TypeScript, Tailwind 4, used shadcn components, system fonts.
Supabase SSR verifies `getUser` plus confirmed email; httpOnly cookie hashes
bind anonymous diagnostics and atomic account claims. Anonymous results are
aggregate-only. Free review has no explanations. All explanations require fresh,
fail-closed paid access on the server. The database rechecks paid/free quota at
session creation. Stripe signed webhooks alone grant passes; refund tombstones
and payment-intent locks beat replay and out-of-order receipt writes.

Public content is local Markdown rendered as safe React nodes, never raw HTML.
Original blogs are archived byte-identically; explicit hash-locked editorial
versions remove prohibited claims. Legal body requires literal `approved: true`
in the two `content/legal` files. Never read or publish `hq/drafts`.
No testimonials, invented statistics, pass guarantees or hours-saved claims.
Keep independent/not affiliated with Google positioning.

## Verification

Use this package environment: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run test:db:local`, `npm run test:e2e:local`, and placeholder-only `npm run
build` (README). Verify money/access/auth/scoring/selection/content safety and
old-URL enumeration. No committed marketing-page suite. Keep the three actual
local browser flows. Do not infer live Stripe/cloud validation from fixtures.
Stay at <=25 direct runtime dependencies; one owner updates package/lock files.
Generate database types from local v2 only, never old `database.types.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
