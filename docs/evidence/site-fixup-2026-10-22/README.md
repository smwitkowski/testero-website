# Site audit fix-up evidence

Local development and loopback-only Supabase fixtures. No production changes, deployment, merge, or remote analytics calls.

## Product choices

- The hero names PMLE and the June 2026 exam guide. Its explicit five-question start respects unfinished sessions.
- Public availability uses the diagnostic allowlist and the minimum 20 approved original-question gate, not a hardcoded marketing list.
- **Five-question reports show sampled-domain reads and a suggested next domain**, with the exact number of questions behind each read. A one-question sample does not get a mastery/status label. Beta results remain tier-only.
- Fresh owner-scoped resume checks and browser-history regressions preserve saved answers. A failed check blocks autostart until retry.
- Founder text is shared by the homepage and `/about`. **Bio text is a draft pending founder approval**.
- The two editorial notice routes redirect permanently. Original blog and hash-locked editorial sources are unchanged.
- Current blue social image: generated offline by `node scripts/generate-social-image.mjs`.
- Answer analytics contain safe metadata only and exclude internal/bot browsers.

## Local screenshots

The report and saved session use the local development database, not production.

- [Hero viewport](screenshots/hero-viewport.png) · [Full homepage](screenshots/hero-desktop.png)
- [Five-question report](screenshots/five-question-report-desktop.png)
- [Resume prompt](screenshots/resume-desktop.png)

## Verification

| Check | Result |
| --- | --- |
| `env -i PATH="$PATH" HOME="$HOME" CI=true npm test` | 90 files, 1,669 tests passed |
| Clean-env `npm run lint` | Passed |
| Clean-env `npm run typecheck` | Passed |
| Clean-env `docker build .` | Passed |
| Clean placeholder-config `npm run build` | Passed |
| `npm run test:db:local` | All local integration checks passed; isolated fixtures removed |
| Fresh-cache clean-env `npm run test:e2e:local` | 14 passed, 16 opt-in skips, zero failures |
| Dedicated all-five-allowlist beta browser run | 5 passed |
| Targeted account/free-practice rerun | 2 passed |

The five beta checks are skipped in the default browser run and were run separately with a local allowlist. Other skipped checks are opt-in QA or production-build checks. Browser tests verify real local persistence, ownership, answer reveals, 5/10/20 reports, Back/Forward/resume, outage retry, report-reason validation, free/paid practice and refund behavior.

The shared browser timing helper accepts both the new diagnostic reveal and unchanged practice reveal. Earlier account/free-practice failures were resolved and the final complete run passed; they are not carried as known failures.

Next dev's generated route cache omitted nested API routes after some server restarts. Final browser verification stopped the server and removed only generated `.next/dev` before starting. Both native and Docker production builds include all nested routes. No route source was changed to work around the cache.

Local raw logs are retained under `.qa/site-fixup/` (not committed). `verification.json` records sanitized outcomes; `screenshots.sha256` records image hashes. Original `content/blog/`, `lib/content/editorial.ts`, legal files, and `content-pipeline/` are unchanged.
