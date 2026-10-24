# D-044 verification

All checks used local fixtures. No production database, Stripe object, Cloud Run service, deployment or merge was touched.

## Completed gates

Each command used `env -i PATH="$PATH" HOME="$HOME" CI=true`.

| Command | Result |
| --- | --- |
| `npm test` | Exit 0: 1,833 tests in 103 files passed |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0:79 static pages generated; mock/API routes compiled |
| `docker build .` | Exit 0; image SHA recorded in [machine evidence](verification.json) |
| `npm run test:e2e:local` | Exit 0:20 passed, 16 existing conditional skips |
| `npm run test:db:local` | Exit 0:all local integration groups passed; isolated fixtures removed |

The 16 existing browser skips are 5 beta cases requiring a server allowlist, 2 cache/cert cases requiring a managed production build, 1 MCP case requiring QA mode, and 8 opt-in seeded UI audit cases. None of the required D-044 scenarios was skipped.

## Required browser coverage

- Real signup/email confirmation, followed by 65 answered free practice questions.
- Free score/domain history visible, correct answers present, paid explanations absent.
- All three honest Pass locks visible; free mock and weak-drill APIs deny access.
- Pass 50-question mock: blueprint mix, no early reveal, saved resume, unchanged deadline, overall/domain scores and all 50 explanation reviews.
- Shortened local deadline triggers automatic submission; late answers cannot alter results. Refund denies result retries.
- Diagnostic/practice/mock history drives fresh-first ordering; weak drills exercise general, diagnostic-focus and sufficient-history paths.
- 375 px navigator asserts that every two-digit question label stays on one line.

## Native database coverage

[Rerun log](evidence/tiers-db-final.log) verifies quota-free concurrent starts, inert historical exhausted buckets, paid-only variants, table/RPC grants and ownership, malformed snapshot rollback, duplicate option text rejection, immutable mock scoring, and fixed 120-minute deadlines.

Independent PostgreSQL transactions hold a mock row lock while an answer waits past expiry. On wake the attempt auto-scores without saving the late answer. A queued read also rechecks paid access after access revocation. Paid-practice RPC checks cover valid/refunded/expired/future-dated passes and legacy access.

## Screenshots

Final screenshots hide only the framework development badge. These are real local app states, not mockups. Mock-result images are top-of-page crops; full 50-question screenshots remain in ignored `test-results/pmle-tiers/`.

| State | Desktop 1280 px | Mobile 375 px |
| --- | --- | --- |
| Pricing | [image](screenshots/pricing-1280.png) | [image](screenshots/pricing-375.png) |
| Free dashboard | [image](screenshots/dashboard-free-1280.png) | [image](screenshots/dashboard-free-375.png) |
| Pass dashboard | [image](screenshots/dashboard-paid-1280.png) | [image](screenshots/dashboard-paid-375.png) |
| Mock in progress | [image](screenshots/mock-in-progress-1280.png) | [image](screenshots/mock-in-progress-375.png) |
| Mock results | [image](screenshots/mock-results-1280.png) | [image](screenshots/mock-results-375.png) |

## Integrity and limits

- [Browser log](evidence/tiers-e2e-final.log), [DB log](evidence/tiers-db-final.log), [frozen test hashes](evidence/tiers-test-source-sha256.json), and [machine evidence](verification.json) preserve the completed results.
- Root rechecked all frozen test hashes after the final browser run, then ran host unit/lint/type/build gates. Runtime source and screenshot digests are recorded in the machine evidence.
- Independent source review found no remaining in-scope blocker after pagination, mock snapshot integrity and paid-selection revocation fixes. Native gates—not the static review—prove runtime behavior.
- Existing dependency install audit reports 2 high and 2 critical advisories. No dependencies changed. The existing Dockerfile placeholder service-key ENV warning also remains. These are out of this pricing task's scope; no real secret was used in the build.
- The coordinator must apply the two migrations and configure the new Stripe price before an approved deployment. No feature was descoped.
