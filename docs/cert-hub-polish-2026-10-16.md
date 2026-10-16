# Certification hub polish — 2026-10-16

PR [#242](https://github.com/smwitkowski/testero-website/pull/242), branch `prime/cert-hub-1016`, still depends on #241. No merge, deployment or production DB change.

## What changed
- Compact summary shows duration, questions, price, languages and validity where stated. The notification form is the next block on mobile; desktop keeps the sidebar.
- Missing optional facts are omitted. Core duration/count/price/languages retain explicit missing values. Case-study rows appear only when applicable, including PCA standard and renewal. Four sparse skills-renewal variants now use one sentence.
- Standard/renewal guide labels, approximate weights (`~20%`), delivery wording and source caution are human-readable. Snapshot/status/missing-field boilerplate is removed. Official announcements retain date uncertainty.
- All15 pages have a specific audience paragraph and4 preparation steps, **200–228 words** per page. Guides, official samples and Skills Boost are linked; only PMLE recommends Testero's available diagnostic. Advice does not imply a particular lab is mandatory or currently catalogued.
- All15 official certification URLs fetched HTTP200 on October16. **14 verbatim recommended-experience phrases** have URL and retrieval date; Generative AI Leader has none stated. No explicit exam codes or additional validity were found. Verification was limited to experience/code/validity; original general fact/guide checked dates and objective bodies are preserved.
- No runtime dependencies, limiter constants, API/auth/cache behavior or database schema changed in this polish. Notification delivery remains outside scope.

## Acceptance evidence
- Clean-env **942 tests /51 files**, lint, typecheck, production build and Docker all pass on `bf08fec`.
- Prerender manifest: hub +15 detail routes, ISR300. Public SEO verifier: **34 pages**, valid schema/canonical, cache300 and no Set-Cookie.
- Production browser: **1 passed (3.0s)** for hub/ACE/PCA/PMLE at1280+375; no overflow; mobile summary→form→audience ordering; new/duplicate/invalid requests; one normalized private row and UTM/source persistence, fixture removed.
- Local DB: RLS, browser-role CRUD denial, service insert, concurrent duplicate identity/date preservation and lowercase check pass. Production auth/cache suite: **1 passed (8.7s)**, canonical confirmation/recovery/reset and20-answer diagnostic/results.
- Read-only independent review: no blockers. Follow-ups resolved: recommendation metadata invariant asserted, notices bounded to checked time, global footer verifies independent/not affiliated positioning.
- Eight fresh full-page screenshots in `/Users/switkowski/.local/state/prime-workers/testero-seo-tech.d/cert-hub/polish/screenshots/` (includes requested ACE/PCA/PMLE1280+375 and hub). Visually checked mobile summary/form order, readable wrapping, desktop sidebar and conditional PCA facts.

## Mobile Lighthouse12
cloud-engineer: performance 96, accessibility/best-practices/SEO100, CLS0; cloud-architect: performance 99, accessibility/best-practices/SEO100, CLS0. Prior pre-final-notice runs were96/95; all runs retained.

## Artifacts and limits
Logs, source fetch evidence and review: `/Users/switkowski/.local/state/prime-workers/testero-seo-tech.d/cert-hub/polish`. Machine-readable word counts, paths, results and Lighthouse scores: `cert-hub-polish-2026-10-16.json`.

Local measurements are not production CDN, hosted email, Google eligibility or distributed abuse-control validation. The existing migration is still local-only; coordinator applies it after an approved merge. No notification launch date or delivery is promised. No new facts were inferred to fill remaining source gaps. No runtime constants changed.
