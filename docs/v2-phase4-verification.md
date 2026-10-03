# Testero v2 Phase 4 — local verification

Phase 3 accepted base: `362e4b22b2ef0b3d2934a0614d4ff28323f6e8d6`.
Worktree: `frontend.prime-testero-code`, branch `prime/v2`. Local evidence is
not production, real Stripe, remote migration, or launch approval.

## Delivered

- Real landing: diagnostic → weakest domains → free weekly practice / PMLE Pass.
  No testimonials, invented statistics, hours-saved promises or pass guarantees.
- Five substantive edited blog Markdown publications and nine FAQ answers with
  visible citations/current-source notices. Original 14 files are byte-identical.
  Hash-locked blog overlays remove unsupported claims; publication-safe titles
  prevent old success-story/expert claims from leaking into SEO/social previews.
  Three FAQ overlays narrowly replace unsourced earnings/promotion/hiring claims.
- Safe React Markdown rendering, no raw HTML/unsafe links/third-party images.
- Only two explicit legal Markdown files can publish body with literal
  `approved: true`; both remain “being finalized”, noindex and excluded from sitemap.
- Canonical/OG/Twitter metadata, clean local 1200×630 social image, robots and
  19 currently indexable public sitemap pages (21 public pages including legal).
- Public bounded DB health check: only `{ok}`, 200/503 and no-store. Daily/manual
  keep-alive fails on HTTP errors, redirects, timeout or anything but `{ok:true}`.
- Non-root standalone Docker runner includes content. Main CI checks then builds
  and deploys with explicit project targeting and merged env/secret bindings.
  Build auth creates no credential file; Docker/git exclude `gha-creds-*.json`.
- Short README/CLAUDE and founder restore/backup/migrate/no-traffic QA/cutover/
  rollback checklist. Removed unused phase placeholder and browser Supabase helper.

## Final route table

| Routes | Behavior |
| --- | --- |
| `/` | Landing / free diagnostic CTA / steps / Pass / FAQ excerpts |
| `/diagnostic` | Anonymous diagnostic start |
| `/diagnostic/[sessionId]`, `/diagnostic/[sessionId]/results` | Owned questions / aggregate results; account review, fresh paid explanations |
| `/pricing` | Free versus $39/90-day Pass; verified-account checkout |
| `/blog`, `/blog/[slug]` | Index and five edited historical posts |
| `/faq`, `/faq/[slug]` | Index and nine cited answers |
| `/terms`, `/privacy` | Approval-gated legal pages; pending placeholders now |
| `/signup`, `/login`, `/forgot-password`, `/reset-password` | Real confirmed-email auth/recovery; reset requires verified user |
| `/auth/confirm` | Email confirmation/recovery callback |
| `/dashboard`, `/account` | Confirmed-account dashboard/access/history/logout |
| `/practice/[id]`, `/practice/[id]/summary` | Owned practice/summary with fresh explanation gates |
| `/checkout/success` | Owned grant status; never trusts checkout redirect as access |
| `/api/auth/{signup,login,logout,forgot-password,reset-password}` | Auth operations |
| `/api/diagnostic`, `/api/diagnostic/[sessionId]/{answer,results}` and session route | Diagnostic creation/state/answers/aggregates |
| `/api/practice`, `/api/practice/[id]/{answer,summary}` and session route | Verified owned practice operations |
| `/api/billing/{checkout,portal,status,webhook}` | Server-price checkout, legacy portal, fresh status, signed payment/refund |
| `/api/health` | Tiny server-side DB read; only `{ok}` |
| `/sitemap.xml`, `/robots.txt` | Canonical public indexing / private route exclusions |
| Legacy manifest + `/blog/tags/*`, `/content/*` | Retained routes or permanent 308 to closest v2 route |

## Measured gates

- Lint, TypeScript and **792 unit tests / 39 files** pass.
- **Three actual Chromium flows** pass: anonymous diagnostic; confirmed accounts,
  owned claim/review, free practice/quota and recovery; signed local SDK-fixture
  fulfillment/refund/replay, paid explanations/practice and active legacy portal.
- **Eight actual local database groups** pass, including RLS/ownership, atomic
  quota/rollback, concurrent claims and payment/receipt/refund ordering.
- Placeholder-only native production build and actual Node 22 standalone Docker
  image build pass. Docker runs as UID 1001 with five blog, nine FAQ and two legal
  files. Pipeline and generated Google credential artifacts are absent.
- HTTP audit of **390/390 historical paths** in both local dev and production
  Docker: **366 permanent 308; 22 direct 200; two retained routes 307 to login**
  (`/dashboard`, `/reset-password`), then 200. All 394 paths including four
  wildcard/query cases resolve; no 404. Old single-question URLs cannot access questions.
- All **21 public pages × 320/1280 widths = 42 layouts per environment** pass:
  one H1, page-specific canonical/OG/description, safe social image, legal gate,
  no overflow, page/console errors or external browser requests. Health is 200
  with local DB and only `{ok:false}` / 503 in DB-off Docker; no auth cookies.
- Product: **4,305 TS/TSX/CSS lines / 104 files** in app/components/lib, excluding
  tests, scripts, docs and content; **562 SQL baseline lines** counted separately.
  **15 direct runtime dependencies** (only added exact `marked@18.0.14`; limit 25).
- Source inventory: 47 old page URLs + 343 question URLs = **390 unique paths**,
  frozen raw XML fixtures with SHA256/count checks; enumeration works in shallow CI.
- `.env.example` matches eight app configuration names; NODE_ENV is platform-owned
  and TESTERO_LOCAL_STRIPE is documented local-only. Removed old debug env read.

## Evidence files (local /tmp, not committed)

- `testero-v2-phase4-unit-ultimate.log`, `-db-ultimate.log`, `-browser-ultimate.log`.
- `testero-v2-phase4-build-final.log`, `-docker-ultimate.log`.
- `testero-v2-phase4-public.json`, `-public-final.log`, `-production-final.json`,
  `-production-final.log`; screenshot folders `-public-visual/` and `-production-final-visual/`.
- `testero-v2-phase4-evidence.json` consolidates metrics, route coverage and proof.

## Protected state and launch limits

`prime/pmle-pass`: `264a1e9f3047aace1a4f633db6a5431282436b09`.
`prime/testero-code`: `7260e08f4d8b18a6cf8bf5df0a3c1fe15133b18e`.
Pipeline tree: `4f8deb4f336bfff9a11ba7732ebe322b42c1ecfb`.
All unchanged. Frozen founder preview process on 3100 was not touched.
No remote Supabase/Stripe/PostHog/cloud operations, migration, push, PR or deploy.
Local npm/Docker dependency fetches are not live product/payment validation.

Founder must approve both legal files and product/support copy; restore/verify
production DB, back up with verified pg_dump restoration, review/apply baseline,
configure 11 required + 2 optional PostHog GitHub secrets and PRODUCTION_URL,
verify Cloud Run/Secret Manager IAM, run real Stripe test-mode/no-traffic QA,
then approve PR-to-main cutover/monitoring/rollback. Main push deploys automatically;
no-traffic candidate deployment is a separate reviewed manual gate.
See `docs/deployment/v2-runtime.md`, `stripe-setup.md` and `docs/launch-checklist.md`.
