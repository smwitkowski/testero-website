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
`<input-stem>-grounded.json` incrementally. Unmapped questions fail without an LLM
call. Other rows use the first best-score current objective, preserving their
lexical flag. Existing text is not cleaned or regenerated: only the marked
answer is projected to A for the existing citer/judge interface; the original
choice-label map is recorded. The existing validator, fetched docs, up to two
citation attempts, mechanical check, and independent judge run in order. PASS
requires every gate. Exit 1 means at least one sampled row failed (or no rows
were sampled); exit 0 means every sampled row passed. Neither exit publishes or
approves content. Recorded accepted and judge-rejected PMLE/ACE pilot outputs
are replayed offline with real frozen source text and the actual citation parser.
The fixtures preserve the recorded reduced judge verdicts, not invented rubric
outputs. Live model quality still needs the keyed smoke run and human review.

**Proposed handling, not implemented:** re-check `ok` items before retaining
review approval; review cited aliases and technical wording before changing
`rename_only` items; inspect current successors for `removed_topic` items and
retire only genuinely out-of-scope or unsalvageable questions; manually map
`unmapped` items or retire them and regenerate grounded DRAFT replacements for
reviewed coverage gaps. Never use positional guide IDs as cross-version aliases.

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
