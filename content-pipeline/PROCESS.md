# Docs-grounded question process

Phase 2 implements the smallest single-answer path from the reviewed Phase 1
registry. No migration or new-cert product support. Generation never publishes.

| Step | Status | Contract |
| --- | --- | --- |
| 1. Refresh registry | EXISTS | Use the explicit sequential refresh; review official guide and inventory diffs. Missing facts remain null. |
| 2. Load scope | EXISTS | `--cert` selects the current standard guide. PMLE codes are preserved in one section map. Other codes are virtual, not DB seeds. Each candidate has cert/objective/guide hash. |
| 3. Fetch objective docs | EXISTS | Exa discovers only `docs.cloud.google.com`; direct HTTP fetches official HTML with checked redirects. URL-bound text, timestamp and hash are required. No snippets, guessed links or positional joins. |
| 4. Allocate and generate | EXISTS | Normalize published section weights for largest-remainder quotas at total N. Cover each domain's objectives round-robin. DSPy emits original four-option, single-key content plus typed option evidence. |
| 5. Mechanical gate | EXISTS | Check schema; require exactly A-D, one fetched URL and nonempty quote at most 300 characters per option. Match each quote case-sensitively, with whitespace normalization only, against its own fetched text. Reject before judging if any check fails. |
| 6. Independent judge | EXISTS | `--judge-model` must have a known vendor family different from `--model`. Judge exact cleaned content against fetched docs. PASS requires score >=0.8 and all rubric checks. Quote presence is provenance, not semantic proof. |
| 7. Founder spot-check | EXISTS | Export random ceil(10%) of the completed DRAFT+GOOD pool. Report objective, guide hash, both models and every option's quote/URL/hash/timestamp. Missing or invalid grounding blocks approval, including legacy ungrounded rows. |
| 8. Approve separately | EXISTS | Preserve DRAFT through generation. Existing manifest, candidate/body fingerprints and guarded updates require explicit human acceptance. An LLM verdict never approves a run. |
| 9. Keep evidence | EXISTS | Store receipt under `review_notes.grounding`; `doc_links` retains URLs. Dry-run saves all attempts, rejections, checks and verdicts, plus frozen fetched text, to gitignored JSON without DB access. |

## Model pair

Verified in the public `https://openrouter.ai/api/v1/models` list on 2026-10-04:
`openrouter/google/gemini-3.8-flash` is the lower-cost generator;
`openrouter/anthropic/claude-sonnet-5.5` supplies a different-vendor judge.
Both list structured outputs. This is a cost/independence choice, not a measured
quality claim. Unknown vendor aliases and same-vendor versions/sizes fail closed.

## Pilot (founder runs with keys supplied in the shell)

From `content-pipeline/`:

```sh
uv run python scripts/generate_all_domains.py --cert machine-learning-engineer --n-questions 6 --dry-run --artifact .cache/generation/pmle-pilot-6.json
uv run python scripts/generate_all_domains.py --cert cloud-engineer --n-questions 4 --dry-run --artifact .cache/generation/ace-pilot-4.json
```

These commands write the named JSON files locally and never construct a DB client.
A nonzero exit means a candidate failed; inspect all candidate records. The normal
non-dry-run path can only use existing seeded domains and stores DRAFT questions;
we did not run it or write to a DB. Do not open `.env*`, backups or credentials.
Native offline checks: `uv run pytest -q` here and `npm test` at the repo root.

## Later

- **Multiple-select:** add when a separately reviewed schema, scoring and report contract can represent more than one key; never fake it as single-answer.
- **New-cert DB seeding and app support:** add after pilot quality review and explicit founder approval of domain identities, seeds and product scope.
- **Freshness impact script:** add when approved questions need scheduled refresh review; stored objective/guide/document hashes provide the joins.
- **Legacy optimizer and metric cleanup:** add after the new path's pilot is accepted and callers can be retired safely; legacy research code is unchanged now.

## Source boundaries

See `certs/STYLE.md` for measured sample style, `certs/README.md` for refresh usage,
and `certs/PMLE-DRIFT.md` / `certs/GAPS.md` for the historical Phase 1 audit (their
old line numbers describe the baseline, not the rewritten Phase 2 files).
Ordinal objective IDs are guide-local locators; review aliases before any future
cross-version migration. Public technical-doc license exceptions still apply.
Write original questions. Never commit official sample stems/options/keys or raw
Forms. Samples are style evidence, not answer authority or live-exam frequencies.
