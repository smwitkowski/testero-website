# Docs-grounded question process

## Current operator flow

The Codex and Claude subscription CLIs are authenticated and ready. The generator
uses `--model codex` (default `gpt-6.1-sol`, high reasoning). For the current
45-candidate batch, generate with `--judge-model external`, then choose either
**the bounded Claude CLI request runner** or **manual independent Claude Code
Sonnet 5.5 subagents**. Both consume the same frozen prompts and full verdict
schemas. Wait for generation to finish before judging or ingesting; do not edit
its artifact or request directory while generation is active. Validate ingestion
with `--dry-run` before any separate DRAFT write. Neither route publishes or
replaces founder review. Exact commands are in the external-judge runbook below.

Phase 2 implements the smallest single-answer path from the reviewed Phase 1
registry. No migration or new-cert product support. Generation never publishes.

| Step | Status | Contract |
| --- | --- | --- |
| 1. Refresh registry | EXISTS | Use the explicit sequential refresh; review official guide and inventory diffs. Missing facts remain null. |
| 2. Load scope | EXISTS | `--cert` selects the current standard guide. PMLE codes are preserved in one section map. Other codes are virtual, not DB seeds. Each candidate has cert/objective/guide hash. |
| 3. Fetch objective docs | EXISTS | Exa discovers only `docs.cloud.google.com`; direct HTTP fetches official HTML with checked redirects. URL-bound text, timestamp and hash are required. No snippets, guessed links or positional joins. |
| 4. Allocate and generate | EXISTS | Normalize published section weights for largest-remainder quotas at total N. Choose a random start offset per domain, then cover objectives round-robin; `--seed` reproduces offsets. Explicit objectives instead cycle in flag order. Record each item's `scenario_moment` and rotate already-running situations, with greenfield at most half (including N=1). Follow rules-v2 S1–S9/O1–O4 in `certs/STYLE.md`. Create original four-option, single-key content, then separately cite the finished options/rationales with required string receipts. |
| 5. Mechanical gate | EXISTS | Check schema; require exactly A-D, one fetched URL and nonempty quote at most 300 characters per option. Match each quote case-sensitively, with whitespace normalization only, against its own fetched text. Retry the cite step once with its mechanical errors; retain both attempts and reject before judging if either required final check fails. |
| 6. Independent judge | EXISTS | `--judge-model` must have a known vendor family different from `--model`. Judge exact cleaned content against fetched docs. PASS requires score >=0.8 and all rubric checks. Quote presence is provenance, not semantic proof. |
| 7. Founder spot-check | EXISTS | Export random ceil(10%) of the completed DRAFT+GOOD pool. Report objective, guide hash, both models and every option's quote/URL/hash/timestamp. Missing or invalid grounding blocks approval, including legacy ungrounded rows. |
| 8. Approve separately | EXISTS | Preserve DRAFT through generation. Existing manifest, candidate/body fingerprints and guarded updates require explicit human acceptance. An LLM verdict never approves a run. |
| 9. Keep evidence | EXISTS | Store receipt under `review_notes.grounding`; `doc_links` retains URLs. Dry-run saves all question/citation attempts, rejections, checks and verdicts, plus frozen fetched text, to gitignored JSON without DB access. Parse failures include at most 2048 characters of sanitized actual LM completion, never keys, headers or transport metadata. |

## Model pair

The founder's current generator/citer choice is `--model codex`, using the
existing Codex subscription (OpenAI), defaulting to `gpt-6.1-sol` at high reasoning (Codex 0.160.0, verified by the founder on the ChatGPT plan).
Use `codex/<model>` to override the model. Every call passes `-m` explicitly.
An unsupported model raises `CodexModelRejectedError` and stops the batch without
fallback. Its message lists visible names from `~/.codex/models_cache.json` when
readable; cached availability can lag new models. No model is blocked before the
CLI runs: the actual rejection message is authoritative, not the cache. The adapter ignores user config/rules,
disables file-capable tool features and web search, and suppresses project-doc
loading. It runs from an empty temporary directory. This is a subscription/cost
choice, not a measured quality claim. The default independent judge is `claude`, using the
Claude subscription CLI (Anthropic), with Sonnet 5.5 by default. Generation and
judging remain separate calls and must have known different-vendor families.
Unknown aliases and same-vendor versions/sizes fail closed. Schema, mechanical
evidence, S1–S8/O1–O3 style and judge gates remain mandatory. Neither subscription
backend makes generation publication or replaces founder approval.

`--judge-model openrouter/anthropic/claude-sonnet-5.5` remains an explicit fallback
for a Codex generator and needs `OPENROUTER_API_KEY` in the shell. The earlier
OpenRouter pilot used `openrouter/google/gemini-3.8-flash` as generator and that
Anthropic judge. Both listed structured outputs in the public
`https://openrouter.ai/api/v1/models` inventory on 2026-10-04; this is historical
model-selection evidence, not a measured quality comparison.

## Pilot (operator runs with keys supplied in the shell)

From `content-pipeline/`:

```sh
uv run python scripts/generate_all_domains.py --cert machine-learning-engineer --n-questions 6 --dry-run --artifact .cache/generation/pmle-pilot-6c.json
uv run python scripts/generate_all_domains.py --cert cloud-engineer --n-questions 4 --dry-run --artifact .cache/generation/ace-pilot-4c.json
```

These commands write the named JSON files locally and never construct a DB client.
A nonzero exit means a candidate failed; inspect all candidate and citation-attempt records. Add `--seed 1234` to reproduce objective offsets. Without a seed, each run chooses fresh offsets. The normal
non-dry-run path can only use existing seeded domains and stores DRAFT questions;
we did not run it or write to a DB. Do not open `.env*`, backups or credentials.
Native offline checks: `uv run pytest -q` here and `npm test` at the repo root.

## Existing-bank drift audit

The audit never changes the bank export or connects to a database. Default mode
uses no LLM, credentials, or network. From `content-pipeline/`:

```sh
uv run python scripts/audit_bank.py --input .cache/bank/pmle-bank-2026-10-04.json
uv run python scripts/audit_bank.py --input .cache/bank/pmle-bank-2026-10-04.json --grounded --limit 10
```

Default mode reads the current PMLE registry and writes `<input-stem>-audit.json`
and `<input-stem>-audit.md` under `.cache/bank/`. It reports every ACTIVE/DRAFT
question; RETIRED questions are excluded. Lexical matching uses the stem and marked
answer, not distractors or explanations. All learner prose is scanned for old
names. Matching is binary IDF-weighted cosine in the objective vocabulary, with
explicit word/brand normalization, a 0.10 minimum, and two shared terms (one for
single-term objectives). The JSON records exact matched terms, scores,
source-cited name aliases, and normalization rules. Best-score ties are retained.
Historical 1.3/5.3 bullets come from `shared/domain_context.py` at `2a01021`; a
historical score >110% of the best current score flags `removed_topic`, unless a
best current objective has at least two terms and every term matches (a credible
lexical successor, such as training AutoML). Search
across all current domains allows moved metadata to map to 2.3 instead of blindly
using the old domain. ACTIVE coverage counts best current ties except
`removed_topic`/`unmapped`. It is a **provisional lexical estimate**, not proof of
scope or factual correctness. Removed headings do not mean product deprecation;
`rename_only` does not certify that a rename is the only factual defect.

`--grounded --limit N` samples up to N ACTIVE/DRAFT rows from sorted question IDs
with `--seed` (default 0). It requires `EXA_API_KEY` and `OPENROUTER_API_KEY` in the
shell and uses the same model-policy defaults as generation. It writes a separate
`<input-stem>-grounded.json` incrementally. Retrieval is question-first: the
existing marked answer, stem, and their key service names form the query. The
lexical objective is only a trailing secondary hint. Relevance is judged against
the complete current certification blueprint, not the provisional objective
mapping. Unmapped questions can also be checked; their mapping remains null.
`retrieval`, `relevance_scope`, and `objective_mapping` are recorded separately.
Existing text is not cleaned or regenerated: only the marked answer is projected
to A for the existing citer/judge interface; the original choice-label map is
recorded. The existing validator, fetched docs, up to two citation attempts,
mechanical check, and independent judge run in order. All sources keep their full
fetched text and hashes. Audit citation calls use a 16000-token output budget
instead of 8000; audit judging uses 4000 instead of 2000. Native token-limit finish
reasons reject the completion even if it parses, and record the explicit
`MaxTokensTruncation` error class per attempt and on the row. Token-limit
truncation is terminal: no retry can hide it, and the row fails before judging.
Non-truncated mechanical failures still receive one citation retry. Judge
truncation also fails the row. PASS requires every gate. Exit 1 means at least one sampled row failed (or no rows
were sampled); exit 0 means every sampled row passed. Neither exit publishes or
approves content. Recorded accepted and judge-rejected PMLE/ACE pilot outputs
are replayed offline with real frozen source text and the actual citation parser.
The fixtures preserve the recorded reduced judge verdicts, not invented rubric
outputs. The real first bank smoke (0/10) also supplies a truncated-explanation
defect (`9783e3d9`), a matrix-factorization retrieval miss (`0f701a7e`), and a partial
citation (`bc566ee0`). Replaying the old missing docs must still fail; a new query
is not evidence of a corrected PASS. That artifact did not capture finish reasons,
so native truncation tests label provider length metadata as simulated while using
the real captured partial completion. Live model quality still needs the keyed
smoke run and human review.

**Proposed handling, not implemented:** re-check `ok` items before retaining
review approval; review cited aliases and technical wording before changing
`rename_only` items; inspect current successors for `removed_topic` items and
retire only genuinely out-of-scope or unsalvageable questions; manually map
`unmapped` items or retire them and regenerate grounded DRAFT replacements for
reviewed coverage gaps. Never use positional guide IDs as cross-version aliases.

## Regeneration runbook (D-025)

Founder decision: replace the legacy PMLE bank domain by domain. The historical
first batch planned two candidates for each of the 15 zero-ACTIVE-coverage
objectives from the lexical audit. The current style regeneration command below
plans three for each of those same objectives, 45 total. Planning is not a promise
that all candidates pass. Explicit
`--objective` flags are validated against the current cert/domain/subsection and
cycled in flag order; duplicate flags are de-duplicated. Domain weights and random
start offsets apply only when no explicit objectives are given.

Run these commands from `content-pipeline/`. Supply keys in the shell only;
`PYTHON_DOTENV_DISABLED=1` prevents the legacy client from reading env files.
Never publish by generating, and never retire legacy questions before founder
approval of enough replacements. Use a new artifact filename for each batch.

### Current style regeneration: 45 DRAFT candidates

Generic inline-judge example; use the external runbook below for the current
batch so judgments can resume independently of generation. Claude CLI
authentication is ready. Do not run both generation commands against the same
artifact filename.

Use this non-dry command from `content-pipeline/` after configuring the existing
Codex and Claude subscriptions. Do not add `--dry-run`. It uses the default
`claude` judge independently of Codex. Supply only `EXA_API_KEY` for retrieval
and `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for DRAFT inserts in the shell;
no OpenRouter key is needed for the subscription pair. Do not read `.env` files.
The 15 exact first-batch objective IDs occur once each in flag order; round-robin
planning allocates three candidates to each. The artifact records every plan
item's `scenario_moment`. That hint rotates recent deployment, monitoring,
migration, cost/latency reduction, security incident and greenfield in that
order. At most half of any plan prefix is greenfield; N=1 is recent deployment.
These are original authoring contexts, not live-exam frequency claims.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 45 --model codex \
  --objective machine-learning-engineer:standard:1.1:5 \
  --objective machine-learning-engineer:standard:1.2:1 \
  --objective machine-learning-engineer:standard:1.2:2 \
  --objective machine-learning-engineer:standard:1.2:3 \
  --objective machine-learning-engineer:standard:2.1:3 \
  --objective machine-learning-engineer:standard:2.2:3 \
  --objective machine-learning-engineer:standard:3.1:4 \
  --objective machine-learning-engineer:standard:3.2:6 \
  --objective machine-learning-engineer:standard:3.3:1 \
  --objective machine-learning-engineer:standard:4.1:4 \
  --objective machine-learning-engineer:standard:4.1:5 \
  --objective machine-learning-engineer:standard:4.2:4 \
  --objective machine-learning-engineer:standard:5.1:2 \
  --objective machine-learning-engineer:standard:6.1:1 \
  --objective machine-learning-engineer:standard:6.2:3 \
  --artifact .cache/generation/pmle-d025-style-45.json
```

Inspect failures and all saved domain run UUIDs. Export the founder sample for
each completed run, then approve only after personal review using steps 2–3
below. Generation leaves accepted rows DRAFT; it never publishes. Retirement
still requires enough approved grounded ACTIVE replacements and a separate
explicit apply. This command was not run as part of the offline code change.

### Rules v2: round 4, 45 candidates

Rules v2 keeps at most two explicit wants/policies, requires knowledge-dependent
distractors, avoids dated model versions, and tests approach choices even for
configuration-heavy objective 1.2:3. O4 authoring targets ±20% option lengths and
never a uniquely longest key. The mechanical gate rejects key leads over two
words or any option outside inclusive 0.75–1.25× mean. It does not pad real old
questions to pass. `option_length_report` is stored on generation/ingestion
artifacts and printed: key-is-longest includes ties, unique-longest is separate,
and the target is ≤35%. Generated, awaiting, and accepted groups are recorded.
A missed batch target prints a warning; it is not an added batch hard gate.

The canonical DSPy verdict now has 14 required fields. Every old check remains;
`distractors_need_knowledge` is a new required boolean. False, missing, or mistyped
values fail closed, even at score 1.0. Export, the Claude request runner and ingest
share this schema. Old real 13-field verdicts are preserved as historical evidence,
not augmented with invented checks. Existing round-3 artifacts and DRAFT rows are
unchanged; do not treat their old verdicts as rules-v2 judgments.

From `content-pipeline/`, run these commands in order. Generation uses the current
Codex `gpt-6.1-sol` default and the same 15 objectives. It requires the existing
Codex login and `EXA_API_KEY`. Claude judging uses its existing subscription login.
Only the final write-ingestion command uses Supabase credentials and makes DRAFT
writes. Run dry ingestion first; inspect all failures and the length report before
separately approving the write. Never regenerate over an existing artifact.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 45 --model codex --judge-model external \
  --objective machine-learning-engineer:standard:1.1:5 \
  --objective machine-learning-engineer:standard:1.2:1 \
  --objective machine-learning-engineer:standard:1.2:2 \
  --objective machine-learning-engineer:standard:1.2:3 \
  --objective machine-learning-engineer:standard:2.1:3 \
  --objective machine-learning-engineer:standard:2.2:3 \
  --objective machine-learning-engineer:standard:3.1:4 \
  --objective machine-learning-engineer:standard:3.2:6 \
  --objective machine-learning-engineer:standard:3.3:1 \
  --objective machine-learning-engineer:standard:4.1:4 \
  --objective machine-learning-engineer:standard:4.1:5 \
  --objective machine-learning-engineer:standard:4.2:4 \
  --objective machine-learning-engineer:standard:5.1:2 \
  --objective machine-learning-engineer:standard:6.1:1 \
  --objective machine-learning-engineer:standard:6.2:3 \
  --artifact .cache/generation/pmle-d025-r4-45.json
```

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/judge_requests.py \
  --requests .cache/generation/pmle-d025-r4-45.judge-requests \
  --verdicts .cache/generation/pmle-d025-r4-45.verdicts \
  --judge-model claude --parallel 3
```

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/ingest_external_verdicts.py \
  --artifact .cache/generation/pmle-d025-r4-45.json \
  --verdicts .cache/generation/pmle-d025-r4-45.verdicts --dry-run
```

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/ingest_external_verdicts.py \
  --artifact .cache/generation/pmle-d025-r4-45.json \
  --verdicts .cache/generation/pmle-d025-r4-45.verdicts
```

### Current external-judge style regeneration: 45 candidates

Claude CLI authentication is ready. The request runner below uses the existing
Claude subscription, not API billing. Manual independent **Sonnet 5.5 subagents**
in the existing Claude Code session remain available as an alternative. The
current `codex` alias defaults to `gpt-6.1-sol` at high reasoning. The active
style-45 batch below retains its explicit `codex/gpt-5.6-sol` selection. Do not
restart or overwrite its artifact. Batch tests are offline; two separately
authorized Claude smoke calls verified the shared transport, not the live batch.

1. **Generate local candidates and judge requests.** From `content-pipeline/`,
   supply only `EXA_API_KEY` in the shell and use the existing Codex subscription.
   Do not read `.env` files or supply DB keys for generation. No `--dry-run` is
   needed: `--judge-model external` **never constructs a DB client or writes to
   the DB**, whether or not `--dry-run` is present. The same 15 first-batch
   objectives cycle in flag order, three candidates each (45 total). Each plan
   item records its rotating `scenario_moment`; at most half are greenfield.
   Use a fresh artifact name for a new batch; the current batch name is below.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 45 --model codex/gpt-5.6-sol --judge-model external \
  --objective machine-learning-engineer:standard:1.1:5 \
  --objective machine-learning-engineer:standard:1.2:1 \
  --objective machine-learning-engineer:standard:1.2:2 \
  --objective machine-learning-engineer:standard:1.2:3 \
  --objective machine-learning-engineer:standard:2.1:3 \
  --objective machine-learning-engineer:standard:2.2:3 \
  --objective machine-learning-engineer:standard:3.1:4 \
  --objective machine-learning-engineer:standard:3.2:6 \
  --objective machine-learning-engineer:standard:3.3:1 \
  --objective machine-learning-engineer:standard:4.1:4 \
  --objective machine-learning-engineer:standard:4.1:5 \
  --objective machine-learning-engineer:standard:4.2:4 \
  --objective machine-learning-engineer:standard:5.1:2 \
  --objective machine-learning-engineer:standard:6.1:1 \
  --objective machine-learning-engineer:standard:6.2:3 \
  --artifact .cache/generation/pmle-d025-style-45.json
```

Only schema- and mechanical-PASS candidates receive a request under
`.cache/generation/pmle-d025-style-45.judge-requests/`. The artifact stores stable,
unique `candidate_id` values, `status: "awaiting_external_judge"`,
`awaiting_external_judge: true`, and each request's artifact-relative path and
SHA-256 of its exact bytes. Candidates are **not accepted and not published**
while awaiting a verdict. Requests include the full fetched official source
text first, up to 150000 serialized characters. If needed, the largest cited
sources are trimmed one at a time to quote-centered windows with 8000 characters
on each side. Windows are merged; they are never narrowed to squeeze a request
under the limit. A request that still exceeds the limit fails closed. Per-source
trimming flags, offsets and hashes are recorded. A quote match alone is not
semantic proof or a judge PASS. Inspect failed candidate records; schema or
mechanical rejects must not be sent for judging.

**Re-export an existing batch after a request-policy change.** Do not regenerate
questions. Rebuild requests offline from the artifact's stored questions, fetched
sources and verified A–D receipts:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/export_judge_requests.py \
  --artifact .cache/generation/pmle-d025-style-45.json
```

The default output is `<artifact-stem>.judge-requests/`. Optional `--out DIR`
must be strictly beneath the artifact's parent directory. Symlinks are forbidden.
This restriction keeps every stored request path safe and artifact-relative.
Ingestion accepts these custom paths and validates the exact new request bytes
against their updated SHA-256 values and the current rubric. Use the same custom
request directory for the judge runner. Prefer a sibling verdict directory named
`<custom-directory>.verdicts`; a directory ending in `.judge-requests` also has its
corresponding `.verdicts` sibling checked.

The exporter validates all outputs before replacing any request. It changes only
request path/hash metadata during a normal export. It preserves questions,
source text, receipts, scopes, candidate IDs and other artifact data. Previously
exported candidates and candidates awaiting judgment are eligible; early rejects
without request metadata are skipped. It validates unique IDs and plan indices,
current registry scope, question schema and mechanical evidence. It makes no live
model, retrieval or DB calls, reads no `.env` files and creates no verdict directory.
No export mode bypasses candidate insertion state or database run journals; those
require human reconciliation.

Any existing JSON verdict in an associated verdict directory blocks normal export.
Checked locations are `<artifact-stem>.verdicts`, the output's `.judge-requests`
counterpart, `<output-directory>.verdicts`, and raw candidate verdict JSON in the
output itself. The runner also records every used verdict directory in the
request directory's `.verdict-directories.json` registry before submitting calls.
The exporter reads these registries from all old request directories and the target,
then locks and checks their registered verdict directories. Registries use strict
version-1 JSON with absolute directory paths. Symlinks or malformed registries block
export. Registered verdict directories must be strictly beneath the artifact parent;
export fails closed for paths outside that boundary.

For historical custom or manually saved verdicts that have no registry, pass
repeatable `--verdicts DIR` options. These directories must also be strictly beneath
the artifact parent. For example, add `--verdicts .cache/generation/manual-results`
to the export command. This option authorizes checking and, with `--force`, archiving
affected results there. Stored judge decisions also require `--force`.
Explicit `--force` moves affected
verdict files to timestamped `.export-quarantine-*` directories instead of deleting
or reusing them. It resets only judge-derived verdict/reason/failure fields and
returns eligible candidates to awaiting judgment, with `accepted: false`. It never
clears DB state. Unrelated verdict files in associated verdict directories are
preserved. Unrelated JSON in the request output, including obsolete candidate
requests, is refused even with `--force`; choose a clean directory. The exporter
never deletes obsolete requests or lets the runner silently judge extra candidates.
Only the known `.verdict-directories.json` registry is excluded from request scans.

The artifact lock prevents concurrent ingestion. The exporter then takes the judge
runner's batch locks on the target and existing metadata-linked request directories
in sorted order, before locking associated verdict directories. The runner also
locks its request directory before its verdict directory. This blocks a concurrent
reader even when its verdict directory does not exist yet, or when `--out` moves
requests to another directory. All locks are nonblocking. Move manually stored
results to a checked verdict location before using `--force`.

Requests are atomically replaced and durably flushed before the artifact is
flushed. When `--out` changes the request directory, the exporter then archives
only old metadata-linked candidate request files, under the held old request locks,
before flushing new artifact paths. Their exact bytes remain in quarantine, but
the old directory can no longer submit those requests. In-place exports do not
retire requests. Unrelated files and noneligible candidates remain untouched.

A partial crash can leave a request/hash mismatch, or old metadata pointing at a
retired request; ingestion then fails closed. Rerun export with the same `--out`
to repair the mismatch. Do not clear persistence journals. The final line is JSON
with request count, minimum/p50/p95/maximum character counts, trimmed count,
archived-verdict count and quarantine paths, plus `retired_requests` and
`request_quarantine_paths`.

2. **Judge the frozen requests: Claude CLI or manual subagents.** Wait for
   generation to finish. Run the bounded subscription CLI runner from
   `content-pipeline/`:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/judge_requests.py \
  --requests .cache/generation/pmle-d025-style-45.judge-requests \
  --verdicts .cache/generation/pmle-d025-style-45.verdicts \
  --judge-model claude --parallel 3
```

   Only `claude` (the Sonnet 5.5 default) or `claude/claude-sonnet-5-5` is allowed.
   Other Claude models are blocked until ingestion provenance supports them;
   the headless Claude Code call is the independent Sonnet 5.5 judge role.
   Parallel defaults to 3 and accepts 1–4. Each request receives exactly one call using its supplied
   prompt and schema verbatim; no rebuilding, trimming, rewriting or retries
   occur within a run. Stale schemas, unsafe IDs, symlink requests and requests
   over 150000 characters fail before a call. The runner uses no DB, retrieval,
   API keys or `.env` files and does not call ingestion.

   Successful output is the raw full schema dictionary, including valid FAIL
   and UNCERTAIN judgments. It is atomically published as `<candidate_id>.json`
   without wrappers or extra fields. Every existing verdict path is skipped,
   even if invalid or human-authored. A verdict-directory batch lock prevents
   two runners from double-calling. Exclusive publication also preserves a
   manual verdict created while a call is in flight.

   Failures go only to `.failures/<candidate_id>.json` with ID, safe error class
   and message, judge model and UTC timestamp; never to the verdict filename.
   Logs, requests and environment values are not copied into failure records.
   Authentication, timeout, schema and exit errors are explicit failures, not
   hidden retries. Only a usage/rate limit stops new submissions; at most the
   other `parallel - 1` calls already running can finish. Authentication errors
   do not stop other requests; authenticate before rerunning failed requests.
   The CLI prints completed/skipped/failed/remaining/usage-stopped and exits 1
   on failures or a stopped batch. Re-run the same command to retry failures and
   finish remaining requests; successful IDs remain untouched and old failure
   records are removed on success. Inspect an invalid existing verdict manually;
   the runner never replaces it automatically.

   **Manual alternative:** founder runs independent Claude Code Sonnet 5.5
   subagents. Give each subagent one saved request. Follow its `judge_prompt` and
   `verdict_schema` **exactly**, including all factual and S1–S8/O1–O3 style checks. Use only the
   supplied data; no browsing, tools, edits, or invented evidence. Save one raw
   JSON object containing precisely the schema fields as
   `.cache/generation/pmle-d025-style-45.verdicts/<candidate_id>.json`.
   Use the ID in the filename, not as an extra JSON field. Do not add wrappers,
   `structured_output`, metadata, `passed`, `model`, or other extra keys. No
   Markdown fences. FAIL and UNCERTAIN are valid judgments, not errors to rewrite.

3. **Validate ingestion without DB access.** Run the dry-run command below.
   It validates request hashes, exact verdict schemas, schema/mechanical gates,
   and the unchanged independent-judge PASS threshold. It never constructs a DB
   client and never marks a candidate inserted. Missing or invalid verdicts,
   failed checks, uncertainty, and scores below 0.8 cannot become accepted rows.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/ingest_external_verdicts.py \
  --artifact .cache/generation/pmle-d025-style-45.json \
  --verdicts .cache/generation/pmle-d025-style-45.verdicts --dry-run
```

4. **Ingest passing DRAFTs only after inspecting the dry-run.** Supply
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the shell, never env files.
   Ingestion creates separate runs per existing domain and writes only passing
   candidates as **DRAFT/GOOD**, never ACTIVE. Use each actual domain run UUID
   saved in the artifact and printed by ingestion for the founder sample and
   approval commands in steps 2–3 of the historical review sequence below.
   `review_batch.py` founder approval is still required; no subagent verdict or
   ingestion command replaces it. Retirement remains a separate approved step.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/ingest_external_verdicts.py \
  --artifact .cache/generation/pmle-d025-style-45.json \
  --verdicts .cache/generation/pmle-d025-style-45.verdicts
```

Ingestion records write-ahead progress for both run creation and question insertion
because multi-row writes are not an atomic transaction. Stable candidate UUIDs
and deterministic per-domain run UUIDs use the existing DB primary keys, so a
pristine artifact copy cannot create duplicate rows. Returned IDs must match the
requested keys. Re-running must never double-insert a candidate already attempted
or inserted. **Partial or unknown write statuses require human reconciliation
before any manual retry.** Stop and inspect the artifact, run UUIDs, question IDs,
and actual DB rows. Do not clear write-ahead markers or rename/copy the artifact
as a way to retry an uncertain write. Dry-run is not reconciliation and must not
mark inserted rows or repair unknown outcomes.

### Historical first-batch command and review sequence

1. **Generate DRAFT candidates (writes; needs `EXA_API_KEY`, `OPENROUTER_API_KEY`,
   `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`).** No `--dry-run`:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 30 \
  --objective machine-learning-engineer:standard:1.1:5 \
  --objective machine-learning-engineer:standard:1.2:1 \
  --objective machine-learning-engineer:standard:1.2:2 \
  --objective machine-learning-engineer:standard:1.2:3 \
  --objective machine-learning-engineer:standard:2.1:3 \
  --objective machine-learning-engineer:standard:2.2:3 \
  --objective machine-learning-engineer:standard:3.1:4 \
  --objective machine-learning-engineer:standard:3.2:6 \
  --objective machine-learning-engineer:standard:3.3:1 \
  --objective machine-learning-engineer:standard:4.1:4 \
  --objective machine-learning-engineer:standard:4.1:5 \
  --objective machine-learning-engineer:standard:4.2:4 \
  --objective machine-learning-engineer:standard:5.1:2 \
  --objective machine-learning-engineer:standard:6.1:1 \
  --objective machine-learning-engineer:standard:6.2:3 \
  --artifact .cache/generation/pmle-d025-first-30.json
```

This batch creates six domain-specific generation runs. Their UUIDs are printed
and saved in the artifact's `generation_runs` mapping. Use each actual run UUID
in steps 2–3; do not treat the entire batch as one run. Inspect failed candidate
records and complete the founder review before approval.

2. **Export the ceil(10%) founder sample for each completed run (read-only DB;
   needs `SUPABASE_URL` and the service-role key).** Replace `RUN_UUID` with a
   printed UUID. The default report path is `review/RUN_UUID.md`:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/review_batch.py RUN_UUID
```

3. **After the founder personally reviews and approves that sample, promote the
   unchanged eligible pool (writes; same DB/service-role keys).** `--yes` attests
   human review; it does not bypass the saved-report/receipt/fingerprint gates:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/review_batch.py RUN_UUID --approve --yes
```

4. **Inspect replacements versus legacy ACTIVE (read-only; DB/service-role keys):**

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/retire_legacy.py
```

5. **Retire one replaced domain only (writes; DB/service-role keys):**

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/retire_legacy.py --apply --domain ARCHITECTING_LOW_CODE_ML_SOLUTIONS
```

Repeat steps 2–3 for every approved run and step 5 for each replaced domain. If
new grounded ACTIVE is below legacy ACTIVE, retirement refuses and prints the
shortfall: generate/review/approve more replacements first. The first gap batch
alone will usually not satisfy every domain's replacement count. `RETIRED` is a
status change, never deletion; repeat application is a no-op after replacement.

Receipt detection reuses the approval gate. Phase-2 `persist_candidate` writes
`review_notes.grounding` alongside the independent judge verdict. A replacement
must be ACTIVE, run-linked, judge-passed, and have complete A-D official-source
receipts and a passing mechanical check; the current PMLE cert, guide hash,
objective ID and objective's owning domain must match. Plain legacy notes with
no grounding receipt remain legacy. Corrupt or invalid receipt-bearing rows do
not count as replacements and block apply. No docs/LLM fetching occurs here.

Pause concurrent content approval/edit/retirement while applying a domain. The
script uses fresh reads and per-row snapshot guards, not a cross-row transaction;
a conflict or unknown update result stops further writes. Inspect the printed
before/after counts before retrying any partial run.

**Judge failure `f4d2e283`:** the recorded artifact contains only the generic
`Judge failed or returned invalid output` verdict, not a raw judge completion,
parse error class or finish metadata. Its citation passed. The glued-marker
cause cannot be confirmed from that record; no speculative judge fix or invented
real-output replay was made. The next proposed diagnostic is a separately
approved, bounded/redacted parse-only judge completion capture and keyed replay
of that saved row. Do not weaken the quality gate to recover a PASS.

## D-025 batch 1 diagnosis and batch 2

Batch 1 stored 19/30 accepted candidates as DRAFT across six runs. This is not
founder approval or publication. Evidence: ignored read-only artifact
`.cache/generation/pmle-d025-first-30.json`, SHA-256
`97d48a7e7cadb3bcf7bcff64e6e360fb3eb41f6e43da11b803feeb0a55fb64de`.
Candidate numbers below are the artifact's 1-based `index` values.

**Parse failures #4, #6, #20:** `GenerationOutputError` specifically wraps
DSPy's `AdapterParseError`, not a transport failure. Their saved `raw_response`
values are all 2,048 characters and end in `[TRUNCATED]` because `_safe_completion`
clips diagnostics locally. This is not evidence of provider token exhaustion.
The saved prefixes contain glued reasoning/stem markers; the current adapter
already normalizes those. Native offline replay of all three saved prefixes
shows the current adapter recovers `stem`, which native ChatAdapter misses.
Both still reject the incomplete prefixes. The missing saved tail cannot prove
the original full-response parse cause. No speculative parser fix or fabricated
complete-response fixture was made; the schema and both quality gates stay unchanged.
`No fetched evidence` / `Not judged` are initial placeholders on these rows:
all three actually have fetched sources, but failed before citation/judging.

| Zero-accepted objective | Candidates and observed cause | Smallest proposed change |
| --- | --- | --- |
| `1.2:3` | #4 parse failure; #19 score .72, uncertain evidence. Veo reference-image key is supported; Gemini image-tuning docs do not establish Imagen's capabilities, and an inference example does not establish an exhaustive client prohibition. | Use distractors refuted by explicit fetched limits, such as the three-reference limit, rather than universal negative capability claims; otherwise fetch the missing capability specification. |
| `2.1:3` | #20 parse failure; #5 schema/mechanical PASS but generic judge output failure, not a substantive rejection. Feature-group/view docs support the topic. | Diagnose the judge boundary before attributing its failure to content. New candidates should state compatible entity keys and the documented timestamp requirements for group-backed sources. Those are content cautions, not proven causes of #5's judge error. |
| `2.2:3` | #6 parse failure; #21 score .60. Manual upload/deploy is documented, so C is not decisively excluded by the claimed rationale. Its exact second-correct status is debatable. D clearly contradicts the quickstart: Spaces deploys a managed model endpoint plus a Cloud Run app. | Make a specific notebook/config-inspection requirement distinguish alternatives; do not claim Spaces lacks a managed endpoint or manual deployment is categorically invalid. |
| `4.1:4` | #10/#25 score .60 each. Rolling-deployment keys are supported, but the stems only replace models; the target requires comparing versions. Fetched docs mix generic Cloud Deploy canary and rolling replacement. | Require a version-comparison decision before promotion; target ML version-comparison/traffic-splitting docs. Remove unsupported blanket cost/rollback claims. Rolling strategies are not banned merely because A/B and canary are examples. |

There is no demonstrated primary overly-strict-judge cause. Relevant source text
was fetched for every candidate; exact quote membership is not full semantic
support. Judge reasons are capped at 300 characters, so their unseen tails and
#5's absent judge completion must not be reconstructed.

**Approved follow-up:** generator instructions require the selected objective's
actual operation/decision, documented explanation claims, and a decisive stated
constraint for each distractor. Discovery queries prioritize the objective's
parenthesized examples (for example A/B testing and canary deployments), rather
than broad subsection services. Existing question-first audit queries stay unchanged.

Parse and judge failures now retain the actual redacted completion up to 20,000
characters, plus allowlisted native finish reasons and numeric token usage when
available. Capture is local to the failure artifact; successful outputs and DB
review receipts do not gain diagnostics. No transport bodies, headers, request
messages or LM history are read or retained. Native token-limit failures remain
terminal. The historical clipped batch-1 tails cannot be recovered by this change.
Neither the judge threshold nor the mechanical gate is loosened.

Exact non-dry batch-2 allocation: four candidates for each target, 16 total,
across three domain runs (4/8/4). The command is unchanged; it uses the approved
follow-up code above. Supply the four generation/DB keys in the shell as in step 1 of
the runbook, use a fresh artifact name, then export/review/approve each run:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 16 \
  --objective machine-learning-engineer:standard:1.2:3 \
  --objective machine-learning-engineer:standard:2.1:3 \
  --objective machine-learning-engineer:standard:2.2:3 \
  --objective machine-learning-engineer:standard:4.1:4 \
  --artifact .cache/generation/pmle-d025-second-16.json
```

## D-025 batch 2 diagnosis and recovery

Batch 2 accepted 8/16 candidates; all four target objectives now have at least
one accepted DRAFT. The ignored original artifact is read-only and unchanged.
Candidate numbers are its 1-based `index` values; these fixes do not rewrite
old verdicts, promote DRAFTs, or claim more live accepts.

- **#5 / #8 judge format errors:** native finish was `stop`, with 309 / 337
  completion tokens, not a token limit. Score headers were respectively
  `[[ ## score ></br>` and `[[ ## score ||> 0.9 <|| ## ]]`. Native ChatAdapter
  appended those unrecognized lines and `0.9` to the preceding
  `evidence_supported` boolean, which then failed typed parsing. Exact observed
  headers are repaired only for the complete, unique, ordered judge schema;
  the body still supplies the typed score. The decorated header's 0.9 must agree
  with the body. Unknown, missing, duplicate, ambiguous or contradictory headers
  fail closed. Both real completions replay as their recorded PASS/all-true/0.9,
  while mutated failed checks, FAIL/UNCERTAIN and low scores remain failures.
- **#9 / #13 / #15 stopped at schema validation:** their role-based stems say
  "A machine learning engineer" but contain none of the current validator's
  scenario keywords (`you`, `your`, `team`, `company`, `client`, `organization`).
  The errors were already in `schema_check.errors`; an early `continue` left the
  initial judge `Not judged` placeholder without a top-level stopping reason.
  Every future non-accepted candidate now records `failure_stage` and `reason`,
  including schema, mechanical, duplicate, judge, persistence and request stops.
  Approved follow-up removes the schema keyword rule and its style penalty.
  The same third-person stems now pass structural validation without rewording;
  independent judge clarity/relevance and the mechanical evidence gate still apply.
- **#16 generation token limit:** `length`, 16,874 input / 7,996 completion /
  24,870 total tokens; only 1,454 characters of a partial visible reasoning field
  were retained. Hidden reasoning consumption is plausible but not measurable:
  the prior metadata capture omitted `completion_tokens_details.reasoning_tokens`.
  Future diagnostics retain that numeric counter, never hidden reasoning text.
  Generation alone now has a 16,000-token cap, a bounded 2x trial; citation and
  judge limits are unchanged, and any token-limit finish remains terminal.
- **Official-doc fetch timeouts:** one retry only (two attempts maximum) for typed
  transient timeout/connection/DNS failures, including `URLError.reason` wrapping
  an SSL handshake `TimeoutError`. HTTP errors, SSL/certificate failures,
  unapproved redirects, invalid HTML/content and decoding errors are not retried.
  Both attempts retain the original approved URL, validated redirects and 30s
  request timeout. Discovery is not retried.

The two remaining substantive judge failures (#7 / #11, score .60) still reject
unsupported Model Garden capability explanations. No judge, mechanical or
publication threshold is loosened. Live yield under these changes is unmeasured.

## Later

- **Multiple-select:** add when a separately reviewed schema, scoring and report contract can represent more than one key; never fake it as single-answer.
- **New-cert DB seeding and app support:** add after pilot quality review and explicit founder approval of domain identities, seeds and product scope.
- **Freshness impact script:** add when approved questions need scheduled refresh review; stored objective/guide/document hashes provide the joins.
- **Legacy optimizer and metric cleanup:** add after the new path's pilot is accepted and callers can be retired safely; legacy research code is unchanged now.

## Validator calibration

Parallel choices are valid; only exact/near duplicates (token similarity >=0.97)
are blocked. A stem must end with `?`, without a wording whitelist. Learner
rationales reject URLs and numeric citations, not ordinary “see” words or bracketed
terms. Service grounding comes from fetched evidence and the judge, not a PMLE-era
service-name list. The old helper remains only for deferred legacy metrics.

## Source boundaries

See `certs/STYLE.md` for measured sample style, `certs/README.md` for refresh usage,
and `certs/PMLE-DRIFT.md` / `certs/GAPS.md` for the historical Phase 1 audit (their
old line numbers describe the baseline, not the rewritten Phase 2 files).
Ordinal objective IDs are guide-local locators; review aliases before any future
cross-version migration. Public technical-doc license exceptions still apply.
Optional dump cross-check (founder policy D-024): view-only, stop at any login
or bot wall, and keep only aggregate notes in `certs/STYLE.md`. Dump items are never
stored, prompted, used as few-shot examples, or treated as an answer key.
Write original questions. Never commit official sample stems/options/keys or raw
Forms. Samples are style evidence, not answer authority or live-exam frequencies.
