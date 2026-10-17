# PR241 auth and cache follow-up — 2026-10-16

## Auth regression comparison

The two original failures are reproduced unchanged on a clean detached `f9c73a4` worktree using `npm run test:e2e:local`: **2 failed / 2 passed (48.2s)**.

- `e2e/accounts-practice.spec.ts:48`, assertion line 110: expected dashboard, received `/login?message=confirmation-failed`.
- `e2e/auth-email.spec.ts:45`, assertion line 30: expected `next=/dashboard`, received null.

The current branch's same original four tests reproduce those same failures; billing/refund and anonymous diagnostic pass. Current run with the new cache test initially added: 3 failed / 2 passed (39.5s); third failure was the new production-header assertion against `next dev` (`no-cache, must-revalidate`). That test is now explicitly production-server-only. It had already successfully confirmed the canonical signup link and reached the dashboard.

Fresh baseline email has parameter names `token_hash`, `type`, `redirect_to`, no `next`. Both checked-in templates instead emit `next`; both versions' strict confirmation schema rejects `redirect_to`. Single HTML entity escaping is correct. Thus these two failures are pre-existing local running-template mismatch, not PR241 nav/proxy/cache regressions. No auth schema, parser or logic was weakened, and shared Supabase was not restarted. See `seo-auth-followup-baseline.md` for provenance. Live hosted email template configuration is not verified.

## Bounded public cache

- Root `revalidate = 300` makes public HTML ISR with a five-minute shared TTL.
- `next.config.ts expireTime = 86400` bounds total stale lifetime: Next emits `s-maxage=300, stale-while-revalidate=86100` (24 hours minus 5 minutes).
- Robots/sitemap also revalidate at 300 seconds.
- Private namespaces `/api`, `/auth`, `/account`, `/dashboard`, `/practice`, `/diagnostic`, `/checkout`, `/results` plus auth pages explicitly set `private, no-store`. Diagnostic layout is `force-dynamic`, including session and results shells; existing server auth remains authoritative elsewhere.
- Hashed `/_next/static` retains `public, max-age=31536000, immutable`.
- `scripts/verify-cache-policy.mjs` checks shared pages with/without invalid auth cookie, no Set-Cookie, private GET/POST responses, and hashed assets. This loopback script uses invalid sessions/error paths; the production Playwright test checks real local authenticated success responses and canonical signup/recovery separately.

## Final verification

- `npm run build`: passes; prerender manifest gives 300-second revalidation for public HTML, robots and sitemap. Robots/sitemap externally send `public, max-age=0, must-revalidate` (safe stricter freshness), while ISR HTML sends the shared TTL above.
- `node scripts/verify-cache-policy.mjs http://127.0.0.1:3116`: passes shared pages with and without invalid auth cookie, 22 private GETs and 13 private POST/error responses, metadata and immutable assets. No cached response sends Set-Cookie.
- `node scripts/verify-public-seo.mjs http://127.0.0.1:3116`: all 18 public content URLs pass bounded-cache/schema checks.
- `env -i PATH="$PATH" HOME="$HOME" node scripts/verify-auth-cache-local.mjs` after building: production Chromium test passes. Canonical signup and cross-browser recovery/password change reach dashboard. Actual authenticated dashboard/account/auth/API/session/results responses are no-store; owned diagnostic answers/results succeed. Public pages with the authenticated cookie remain shared, omit user ID and send no Set-Cookie. Test does not fix or claim success for stale received mail templates.
- Production Secure cookies are explicitly forwarded in-memory for APIRequest on loopback HTTP; Chromium navigations use real cookie handling. No cookie values/credentials are printed or committed; failed exploratory Playwright traces were removed.

`env -i PATH="$PATH" HOME="$HOME" CI=true npm test`: 910 tests / 48 files passed. `npm run lint`, `npm run typecheck`, and `docker build .` passed. No deployment/merge or external CDN validation is performed by this follow-up.
