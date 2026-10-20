# ChatGPT MCP verification — D-042 / coordinator revision

PR: https://github.com/smwitkowski/testero-website/pull/293. Never merge without founder approval.

## Public repository boundary

- The checked-in `lib/chatgpt/free-set.json` contains **40 IDs plus selection-rule metadata only**. No question stems, options, answer keys or explanations are included.
- The offline selector reads an ignored local content export and emits only IDs. It retains the same 40 IDs and Hamilton allocation **5 / 7 / 8 / 8 / 7 / 5**.
- At request time the server reads Supabase through its server-only service client. Both the query and returned-row validation enforce: allowlisted ID, `exam = GCP_PM_ML_ENG`, `status = ACTIVE`, `review_status = GOOD`, and `parent_question_id IS NULL`.
- A bounded, per-instance validated-content cache expires after 30 seconds. No stale cache fallback after expiry or DB failure. Newly ineligible rows can remain visible only within that short freshness window; no outside question replaces them.
- Runtime validates complete A–D answers, one key, all explanations and noncommercial text. `get_practice_question` returns only stem/options, never the key or explanations. `check_answer` rejects non-allowlisted IDs before a content lookup.
- Tests use explicitly synthetic authored fixtures and mock the DB. No real bank content is copied into test fixtures.

## Public evidence redaction

`docs/chatgpt-mcp-smoke-transcript.json` is **structure-only**. It retains methods, HTTP status, protocol version, schema names/types, field structure and counts. It redacts question content, identifiers, answer labels and explanations, including JSON serialized into MCP text content. `scripts/chatgpt/transcript.mjs` applies this before any smoke transcript is saved. Tests check both nested serialized text and the committed transcript.

The original PR commits contained real content before coordinator review. The branch will be squashed onto `origin/main` and force-pushed with an explicit lease as authorized. This removes them from PR branch ancestry, but **does not prove that GitHub cached views, PR refs, forks or clones have forgotten the already-public data**. The coordinator/founder should assess GitHub Support removal. Old commit IDs are reported privately in worker status and the final handoff, not linked here.

## Public support page

This PR adds `/support` with selectable `support@testero.ai`, suggested information to include, no promised response deadline, and links to `/privacy` and the actual `/terms#refunds` section. It is included in public paths, sitemap and unauthenticated cache/proxy tests. Verify deployed HTTPS reachability after merge/deployment; no deployment is claimed here.

## Required gates and live smoke

Final revision commands and measured results are recorded below once complete. Commands use `env -i PATH="$PATH" HOME="$HOME" CI=true`:

```sh
npm test
npm run lint
npm run typecheck
docker build -t testero-chatgpt-app:local .
npm run test:db:local
npm run qa:local -- --mcp-smoke
```

The scoped QA mode uses its own port 3107 and the ordinary local Supabase/bootstrap process; it does not reuse a foreign worktree server on port 3000. It covers the MCP flow, not the full browser QA suite. No production writes or cloud deployment. The runtime now requires normal server-side Supabase configuration; the earlier no-DB standalone-image claim is superseded by this revision.

## Dependencies and submission

Official MCP SDK **1.32.1**; **15 runtime / 25 total direct dependencies**. The earlier audit reported 20 findings (2 low, 3 moderate, 14 high, 1 critical), with affected package-node versions unchanged from the original `origin/main` lockfile; this is not a new baseline advisory scan or a claim that existing risks are fixed. Broad dependency upgrades remain separate work.

Current OpenAI sources, ZIP templates, 5 positive + 3 negative cases and an 85-second walkthrough are in [the submission pack](./chatgpt-app-submission.md). Founder still owns identity verification, deployed real ChatGPT validation, challenge configuration, legal/content-rights review, final icons/category/ZIP, recording and portal submission/publishing. `/support` is now implemented; confirm it is deployed instead of treating a local route as already live.

## Coordinator-revision results

- Clean `npm test`: **1,384 passed across 80 files**.
- Clean lint and typecheck: passed.
- Clean Docker build: passed; image `sha256:b6c4e9998f304ff7c6f80196c6ec4c4337efe7f9cfca56eed1f69992521950e4`.
- Clean `npm run test:db:local`: passed; no repository migration or production write.
- Clean `npm run qa:local -- --mcp-smoke`: **1 passed**, **25 HTTP exchanges**, protocol **2025-11-25**; additionally asserts all **40** selected questions are currently eligible in the local DB. Public proof is redacted before saving.
- Focused coverage: 34 offline selector/IDs-only tests; 113 MCP/runtime DB tests; 22 analytics tests; 4 transcript-redaction tests; support/SEO/proxy/Markdown tests.
- Built-image HTTP checks passed: `/support` 200 with selectable contact and policy links, `/terms` real `refunds` anchor, sitemap contains `/support`, and missing DB configuration yields only the generic MCP unavailable result. No runtime credentials supplied for this fail-closed check.
