# Docs-grounded question process

Phase 2 implements the smallest single-answer path from the reviewed Phase 1
registry. No migration or new-cert product support. Generation never publishes.

| Step | Status | Contract |
| --- | --- | --- |
| 1. Refresh registry | EXISTS | Use the explicit sequential refresh; review official guide and inventory diffs. Missing facts remain null. |
| 2. Load scope | EXISTS | `--cert` selects the current standard guide. PMLE codes are preserved in one section map. Other codes are virtual, not DB seeds. Each candidate has cert/objective/guide hash. |
| 3. Fetch objective docs | EXISTS | Exa discovers only `docs.cloud.google.com`; direct HTTP fetches official HTML with checked redirects. URL-bound text, timestamp and hash are required. No snippets, guessed links or positional joins. |
| 4. Allocate and generate | EXISTS | Normalize published section weights for largest-remainder quotas at total N. Choose a random start offset per domain, then cover objectives round-robin; `--seed` reproduces offsets. DSPy first creates original four-option, single-key content, then separately cites the finished options/rationales with required string receipts. |
| 5. Mechanical gate | EXISTS | Check schema; require exactly A-D, one fetched URL and nonempty quote at most 300 characters per option. Match each quote case-sensitively, with whitespace normalization only, against its own fetched text. Retry the cite step once with its mechanical errors; retain both attempts and reject before judging if either required final check fails. |
| 6. Independent judge | EXISTS | `--judge-model` must have a known vendor family different from `--model`. Judge exact cleaned content against fetched docs. PASS requires score >=0.8 and all rubric checks. Quote presence is provenance, not semantic proof. |
| 7. Founder spot-check | EXISTS | Export random ceil(10%) of the completed DRAFT+GOOD pool. Report objective, guide hash, both models and every option's quote/URL/hash/timestamp. Missing or invalid grounding blocks approval, including legacy ungrounded rows. |
| 8. Approve separately | EXISTS | Preserve DRAFT through generation. Existing manifest, candidate/body fingerprints and guarded updates require explicit human acceptance. An LLM verdict never approves a run. |
| 9. Keep evidence | EXISTS | Store receipt under `review_notes.grounding`; `doc_links` retains URLs. Dry-run saves all question/citation attempts, rejections, checks and verdicts, plus frozen fetched text, to gitignored JSON without DB access. Parse failures include at most 2048 characters of sanitized actual LM completion, never keys, headers or transport metadata. |

## Model pair

Verified in the public `https://openrouter.ai/api/v1/models` list on 2026-10-04:
`openrouter/google/gemini-3.8-flash` is the lower-cost generator;
`openrouter/anthropic/claude-sonnet-5.5` supplies a different-vendor judge.
Both list structured outputs. This is a cost/independence choice, not a measured
quality claim. Unknown vendor aliases and same-vendor versions/sizes fail closed.

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

Founder decision: replace the legacy PMLE bank domain by domain. The first batch
plans two candidates for each of the 15 zero-ACTIVE-coverage objectives from the
lexical audit. Planning is not a promise that all candidates pass. Explicit
`--objective` flags are validated against the current cert/domain/subsection and
cycled in flag order; duplicate flags are de-duplicated. Domain weights and random
start offsets apply only when no explicit objectives are given.

Run these commands from `content-pipeline/`. Supply keys in the shell only;
`PYTHON_DOTENV_DISABLED=1` prevents the legacy client from reading env files.
Never publish by generating, and never retire legacy questions before founder
approval of enough replacements. Use a new artifact filename for each batch.

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
  The schema keyword rule is unchanged; replacing it requires a separate decision.
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
