# ChatGPT MCP verification — D-042 / multi-exam revision

Historical PMLE PR: https://github.com/smwitkowski/testero-website/pull/293. Never merge without founder approval.

**Current revision status (2026-10-22):** local multi-exam release gates pass.
The results in the next section apply to this revision. Results labeled historical
later in this file apply only to the earlier PMLE revision. No production write,
deployment, merge, portal submission or deployed ChatGPT acceptance is claimed.

## Current multi-exam gate results

| Gate | Completed result |
| --- | --- |
| `env -i PATH="$PATH" HOME="$HOME" CI=true npm test` | **1,611 passed / 84 files** |
| `env -i PATH="$PATH" HOME="$HOME" CI=true npm run lint` | Passed |
| `env -i PATH="$PATH" HOME="$HOME" CI=true npm run typecheck` | Passed |
| `docker build .` | Passed; image `sha256:252257828530db9e36e721baf80fed26b1e7dfa8beeece1dde9a098249a5f844` |
| Clean-environment `npm run qa:local -- --mcp-smoke` (final run with `DEBUG=pw:webserver`) | **1 passed**, **30 HTTP exchanges**, protocol **2025-11-25**; all **40** selected PMLE questions eligible in local Supabase |

The final SDK run was recorded at **2026-10-22T16:37:25.917Z**. It uses the
official MCP client and checks the four generic tools, advertised exam enum and
PMLE default, unknown-exam errors listing enabled exams, every PMLE domain,
fixed-set membership, withheld keys, full answer explanations and outside-set
rejection. Multi-exam/disabled-exam/cross-exam tests use authored synthetic
fixtures; no additional real exam set is enabled by this revision. Public proof
is [the structure-only transcript](./chatgpt-mcp-smoke-transcript.json).

The final full test run was serial after a 5-second timeout in the unchanged
local sample-bank isolation check under concurrent compiler load. No timeout was
increased and no test was skipped or weakened. An earlier SDK attempt timed out
on dev-server readiness; clearing only generated dev output and rerunning serially
passed. Docker's initial registry TLS timeout cleared on one bounded retry.

Independent read-only review found no remaining code blockers. It prompted strict
whole-map provenance validation and separate stored guide/certification/experience
retrieval dates; the final tests cover both. The PMLE manifest and dependency
files are unchanged. Docker's `npm ci` reported **21 audit findings** (2 low,
3 moderate, 15 high, 1 critical) in the existing dependencies; this change does
not remediate them. The Dockerfile's existing placeholder service-key warning is
not evidence that a real key was used; builds received no runtime credentials.

## Public repository boundary

- `lib/chatgpt/free-sets.json` maps additional database exam IDs to IDs-only manifests (`version`, `source`, `question_ids`). PMLE retains its original **40 IDs and selection-rule metadata** in `lib/chatgpt/free-set.json`. No stems, options, answer keys or explanations belong in either file.
- The original PMLE offline selector emits only IDs from an ignored local content export. PMLE retains its 40 IDs and Hamilton allocation **5 / 7 / 8 / 8 / 7 / 5**. New evidence uses synthetic fixtures only, not that corpus.
- At request time the server reads Supabase through its server-only service client. Both the query and returned-row validation enforce: allowlisted ID, the requested enabled exam, `status = ACTIVE`, `review_status = GOOD`, `parent_question_id IS NULL`, and `single_select` type. Returned rows from another exam cannot pass validation.
- A bounded, per-instance validated-content cache expires after 30 seconds. No stale cache fallback after expiry or DB failure. Newly ineligible rows can remain visible only within that short freshness window; no outside question replaces them.
- Runtime validates complete A–D answers, one key, all explanations and noncommercial text. `get_practice_question` returns only stem/options, never the key or explanations. `check_answer(question_id, selected_label)` accepts no `exam` parameter and resolves membership only across enabled sets; it rejects outside/disabled IDs before content lookup.
- Tests use explicitly synthetic authored fixtures and mock the DB. No real bank content is copied into test fixtures.

## Multi-exam contract to verify

- Listing: **Testero Google Cloud Exam Prep** (30 characters); package `testero`;
  short description **Practice Google Cloud exams**. PMLE now, more Google Cloud
  certifications over time; starter prompts explicitly name PMLE.
- Tool list: `exam_overview(exam?)`, `list_practice_domains(exam?)`,
  `get_practice_question(exam?, domain?)`,
  `check_answer(question_id, selected_label)`. The first three schemas advertise
  an optional enum of enabled database exam IDs, not a free-form certification slug.
- Server `CHATGPT_EXAMS` is a comma-separated allowlist; when unset, it defaults to `GCP_PM_ML_ENG`. An explicitly empty value is invalid.
  Invalid configuration fails closed. Omitted `exam` means PMLE; if PMLE is
  disabled, omission fails clearly instead of selecting a different exam.
  Unknown/disabled exam errors list available exams.
- Guide facts and domains reuse the site's existing certification registry and
  taxonomy. `guide_retrieved_at`, `certification_page_retrieved_at` and
  `recommended_experience_retrieved_at` use their matching stored source roles.
  They are retrieval dates, not live verification or a shared certification date.
  No prices, registration, guarantees or live-check claims. Preserve
  no-auth, read-only, non-destructive, closed-world annotations and the existing
  random-question non-idempotent annotation.
- Question-serving and checking enforce each enabled set independently. Test
  wrong-exam DB rows, disjoint sets, overlapping IDs/configuration, disabled-set
  IDs, default selection and empty/invalid configuration with synthetic data.
- Both analytics events include the database exam ID while retaining existing
  privacy boundaries. Do not collect full conversation, user answer text or
  question content. Confirm legal/data-practice accuracy separately; these docs
  do not approve or change legal policy.
- Only existing PMLE informational links are policy-reviewed. Other exams must
  not gain unreviewed cert-page links from enablement alone. Keep no-commerce
  checks on normal, validation-error and unavailable responses.
- Adding an exam requires an IDs-only manifest plus the server allowlist, with
  facts/domains already in the registry/taxonomy. Every manifest requires strict
  `source`: literal `local-export` kind, literal `read-only-database-content-export`
  upstream, valid UTC `exported_at` in exact `YYYY-MM-DDTHH:mm:ss.sssZ` form,
  lowercase 64-hex `export_sha256`, and a
  lowercase hyphenated machine-token `selection` of at most 100 characters.
  Additional sets may omit `blueprint_sha256`; when present it is lowercase
  64-hex. No arbitrary/nested source keys. See [fixed sets](./chatgpt-free-set.md)
  for the valid shape and synthetic-example boundary.
  D-043 beta-diagnostic flags do not enable ChatGPT tools.

## Public evidence redaction

`docs/chatgpt-mcp-smoke-transcript.json` is **structure-only**. It retains methods, HTTP status, protocol version, schema names/types, field structure and counts. It redacts question content, identifiers, answer labels and explanations, including JSON serialized into MCP text content. `scripts/chatgpt/transcript.mjs` applies this before any smoke transcript is saved. Tests check both nested serialized text and the committed transcript.

The original PR commits contained real content before coordinator review. The historical coordinator revision recorded a plan to squash onto `origin/main` and force-push with an explicit lease. This documentation task did not perform or verify that history rewrite. A completed rewrite would remove them from PR branch ancestry, but **does not prove that GitHub cached views, PR refs, forks or clones have forgotten the already-public data**. The coordinator/founder should assess GitHub Support removal. Old commit IDs are reported privately in worker status and the final handoff, not linked here.

## Public support page

The existing application includes `/support` with selectable `support@testero.ai`, suggested information to include, no promised response deadline, and links to `/privacy` and the actual `/terms#refunds` section. It is included in public paths, sitemap and unauthenticated cache/proxy tests. Verify deployed HTTPS reachability after merge/deployment; no deployment is claimed here.

## Required gates and live smoke

Run all gates against the final multi-exam revision. The required clean test command is `env -i PATH="$PATH" HOME="$HOME" CI=true npm test`; use a clean environment for the other gates where supported. The commands below reproduce the local gates; the completed results are recorded above:

```sh
env -i PATH="$PATH" HOME="$HOME" CI=true npm test
env -i PATH="$PATH" HOME="$HOME" CI=true npm run lint
env -i PATH="$PATH" HOME="$HOME" CI=true npm run typecheck
docker build .
env -i PATH="$PATH" HOME="$HOME" CI=true DEBUG=pw:webserver npm run qa:local -- --mcp-smoke
```

The scoped QA mode uses its own port 3107 and the ordinary local Supabase/bootstrap process; it does not reuse a foreign worktree server on port 3000. It covers the MCP flow, not the full browser QA suite. No production writes or cloud deployment. DB-backed runtime requires normal server-side Supabase configuration; the earlier no-DB standalone-image claim is superseded by this revision.

## Historical dependency inventory and submission responsibilities

The earlier PMLE revision recorded official MCP SDK **1.32.1** and **15 runtime / 25 total direct dependencies**; recheck the final lockfile rather than treating this inventory as current gate evidence. The earlier audit reported 20 findings (2 low, 3 moderate, 14 high, 1 critical), with affected package-node versions unchanged from the original `origin/main` lockfile; this is not a new baseline advisory scan or a claim that existing risks are fixed. Broad dependency upgrades remain separate work.

Current OpenAI sources, ZIP templates, 5 positive + 3 negative cases and an 85-second walkthrough are in [the submission pack](./chatgpt-app-submission.md). Founder still owns identity verification, deployed real ChatGPT validation, challenge configuration, legal/content-rights review, final icons/category/ZIP, recording and portal submission/publishing. `/support` is now implemented; confirm it is deployed instead of treating a local route as already live.

## Historical PMLE coordinator-revision results (not multi-exam gates)

- Earlier clean `npm test`: **1,384 passed across 80 files**.
- Clean lint and typecheck: passed.
- Clean Docker build: passed; image `sha256:b6c4e9998f304ff7c6f80196c6ec4c4337efe7f9cfca56eed1f69992521950e4`.
- Clean `npm run test:db:local`: passed; no repository migration or production write.
- Clean `npm run qa:local -- --mcp-smoke`: **1 passed**, **25 HTTP exchanges**, protocol **2025-11-25**; additionally asserts all **40** selected questions are currently eligible in the local DB. Public proof is redacted before saving.
- Focused coverage: 34 offline selector/IDs-only tests; 113 MCP/runtime DB tests; 22 analytics tests; 4 transcript-redaction tests; support/SEO/proxy/Markdown tests.
- Built-image HTTP checks passed: `/support` 200 with selectable contact and policy links, `/terms` real `refunds` anchor, sitemap contains `/support`, and missing DB configuration yields only the generic MCP unavailable result. No runtime credentials supplied for this fail-closed check.
