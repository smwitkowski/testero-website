# Codex audit fixes — 2026-10-18

Local acceptance evidence for `prime/ux-codex-1018`. No merge, production sign-in or production database writes.

| Finding | Implementation | Publication |
| --- | --- | --- |
| A01 | Code-backed privacy draft; collection links | Founder/legal approval required; `approved: false` |
| A02 | $39/90-day/7-day-refund service draft; pricing terms link | Founder/legal approval required; `approved: false` |
| A03 | Secondary pass option beside top recommendation; free path primary, lower offer retained | Ready for review |
| A04 | Paid-intent signup preserves price, period, confirmation then checkout and free benefits | Ready for review |
| A05 | Server-only usable ACTIVE+GOOD PMLE distinct count, observed blueprint coverage, repeat caveat, checked date | 3600-second cache; query failure omits count |
| A06 | PMLE purpose intro, immediate CTA, compact facts, one lower detailed section | Ready for review |
| A07 | Direct Using Testero FAQ before certification articles | Ready for review |
| A08 | Carousel target >=44px; report select/email >=48px | Browser measurements |
| A09 | Plain registration summary, GA, purpose-labelled links, one missing-metadata disclosure | Dates/uncertainty retained |
| A10 | Hiding prose preserves result and option correctness markers | Independent sample state retained |

## Evidence locations

Local screenshots: `.qa/codex/shots/`; manifest: `.qa/codex/manifest.json`. Desktop 1280×844 DPR1; mobile 390×844 touch/mobile DPR2. Anonymous, confirmed free and paid local fixture roles. Route/state filenames identify variants. TEMPORARY-APPROVED captures only test local legal rendering; they do not record approval.

Completed clean-environment checks: `npm test` (74 files, 1170 tests), `npm run lint`, `npm run typecheck`, `docker build .`, `npm run qa:local` (17 passed, 7 intended project skips). Focused UI capture passed (138 records); temporary approved legal fixture passed (12 records). Combined manifest contains 150 screenshots. The capture spec measures carousel >=44px, diagnostic report select/email >=48px, PMLE CTA fully above fold, no horizontal overflow and no page errors.

Logs: `.qa/unit.log`, `.qa/lint.log`, `.qa/typecheck.log`, `.qa/docker.log`, `.qa/qa.log`, `.qa/qa-final.log`, `.qa/capture.log`, `.qa/legal-capture.log`. `.qa/report.json` records the required qa:local run. Visual review coverage and limits are in `VISUAL-REVIEW.md`.

Example screenshots (each under `.qa/codex/shots/`):
- A01/A02: `anonymous-privacy-TEMPORARY-APPROVED-{1280,390}.png`, `anonymous-terms-TEMPORARY-APPROVED-{1280,390}.png` and matching `-gated-` variants.
- A03: `{anonymous,free,paid}-results-{5,10,20}-{1280,390}.png` and `-viewport.png`.
- A04: `anonymous-signup-{free,paid-intent}-{1280,390}.png`.
- A05–A07: `{anonymous,free,paid}-{pricing,machine-learning-engineer,faq}-{1280,390}.png`.
- A08: `{anonymous,free,paid}-carousel-{1,2,3,4}-{1280,390}.png`, `*-report-open-*.png`, `paid-practice-report-open-{1280,390}.png`.
- A09: `*-exam-guide-changes-*.png`, `*-tracker-expanded-*.png`, `*-tracker-agentic-detail-*.png`.
- A10: `*-samples-{initial,revealed,hidden-feedback-retained}-*.png`.

The local mirror is existing content-only QA data (157 ACTIVE rows), not a fresh production inventory claim. The UI computes usable inventory at runtime; no question count is hardcoded. Fake Stripe proves local behavior only.

## Approval gaps

Both legal files remain `approved: false`. TODOs identify operator/legal entity, postal address, governing law, processing locations, Cloudflare/auth-email configuration, analytics heatmaps/consent/opt-out, retention/deletion process and refund/consumer-rights details. These must be confirmed before legal publication. MCP had no connections, so artifact review database feedback was not accessible. No production canvas refresh or deploy is claimed.
