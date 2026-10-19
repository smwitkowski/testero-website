# Documentation retrieval experiment — 2026-10-19

**Draft / default-off.** No live models, production requests or DB writes were
run. The original3–5× tokens-per-accepted target is **not demonstrated**. Quote
recall does not rejudge semantic support or independent quality.

## Recommendation and selected configuration

Use the cheapest **measured** paired-pass point as the retrieval flag's default
configuration, while leaving the flag **off**. Selected: **2,200-character chunks,
350 overlap, top3 hits per query, product-enriched plan queries, one neighboring
chunk each side, no local-section windows;130,000-character total doc cap**
(~32.5k chars/4-estimated doc tokens, including up to8k-character frozen objective
prefix). Source introduction/title anchors and original-span merging remain.
Compared with the initial flag configuration: cap60k→130k, top-k all→3,
objective queries→product-enriched queries, neighbors0→1; chunk/overlap unchanged.
The class-level RetrievalConfig defaults remain a neutral baseline for sweeps;
DEFAULT_CONFIG explicitly selects this measured policy for live opt-in use.

Standalone replay with **no sweep memoization** confirms:

| Set | Calls | Quote recall | Est. baseline prompt tokens | Est. selected prompt tokens | Est. reduction |
|---|---:|---:|---:|---:|---:|
| b28 |69|**57/60=95.00%**|6,354,518|2,171,591|**65.83% (2.93×)**|
| ACE-b2 |22|**50/52=96.15%**|1,493,274|638,750|**57.22% (2.34×)**|
| Pooled |91|107/112 (each-set gate applies)|7,847,792|2,810,341|**64.19% (2.79×)**|

Pooled mean total verifier prompt size is **30,883 estimated tokens/call**. The
130k cap bounds documentation, not the entire verifier prompt. Counts are
reconstructed prompt characters/4 rounded up, not provider usage, cache hits,
cost, accepted-question savings or semantic noninferiority. Tuning used both
sets, so **neither is held-out validation**. Default attempts remain3.
The original8–15k doc-token target remains unmet; coordinator explicitly asked
for the lowest-cost paired-pass frontier, permitting a larger budget.

## Evidence and sweep protocol

`frontier.md` contains the concise configuration table and budget frontier.
`frontier-*.jsonl` contains completed configurations only; config JSON files
reproduce explicit waves. `frontier-notes.md` explains query/neighbor/window
variants and the interrupted expensive800/500/all-positive grid. Some early
exploration rows predate sweep provenance and the alias/time cache-key fix; they
are not A/B authorization. Current `frontier-selected.jsonl` has code, sweep and
artifact fingerprints. Authoritative `replay-b28-selected.json` and
`replay-ace-b2-selected.json` independently rerun the live default without caching.
The two-set selected point must match both those standalone totals exactly.
No quote text is used for ranking, query formation or span injection.

`miss-diagnosis.md` locates all10 misses in the original60k b28 replay: all pages
were fetched and all quotes fit complete raw chunks. **Zero wrong-page acquisition
or chunk-boundary failures**; ranking/budget allocation loses even rank4 material.
Long scenario queries dilute product capabilities; pumps/users and tutorial
pipeline definitions show the strongest terminology mismatch. Neighbors help
retain table/paragraph context; overlap alone and shorter chunks did not solve
both sets. Fixed6k local source windows were tested as an explicitly labeled
surrogate, **not recovered HTML heading sections**. The selected config does not
use those windows. Full semantic verification remains mandatory.

PMLE SHA256: `2c50b82e9d1c10493d949a24bdb9d58d2a2955e8bc634d888aa794ca83b7699c`.
ACE SHA256: `85d81dce77d6b4a1fe6f1575f11087d7ead99ca58bc07321c1ecfac5c50a1ab1`.
Replay uses recorded candidate indices and rejects objective rotation drift.
b28 has15 nonempty proofs/60 mechanically valid receipts plus54 empty vetoes;
ACE has13 nonempty proofs/52 valid receipts plus9 empty vetoes. Empty vetoes
supply no quote denominator. General replay scores all recorded proposed reasons,
including invalid ones if present; neither frozen set has mechanically invalid
nonempty proofs. Quote receipt recall is not veto or accepted-question quality.
Initial b28 reports `replay-b28.json` (50/60 at60k) and `replay-b28-45k.json`
(59/60 at180k) are **historical configurations**, not current A/B authorization.

## Implemented switches and safety

- `--doc-cache`: official-document snapshots in `.cache/documentation/`, requested
  URL key, original timestamp/hash, **7-day TTL**, bounded **32MiB** read, atomic
  replace. Stale/corrupt/malformed snapshots miss; disk-write failure does not
  discard fresh fetched evidence. Existing single-flight behavior remains.
- `--verify-retrieval`: selected config above. Selected exact-span receipts must
  also pass original full-source URL/hash/quote checks. Immutable full sources
  remain for writer windows and independent judges. No fabricated text, silent
  full-context fallback, automatic approval or gate relaxation.
- `--verify-stable-prefix`: same typed CLI/DSPy verifier signature order:
  instructions/output contract, frozen objective docs, stable objective, candidate
  passages, variable scope and plan. Provider-cache benefit remains unknown.
  First successful objective preparation freezes prefix per run; A/B uses
  parallel1 to avoid concurrent prefix-admission differences.
- `--decision-attempts 1|2|3`: total cap default3 unchanged. No speculative cheap
  semantic precheck. Static cap2 loses2 of b28's8 accepted candidates; adaptive
  scheduling means those static counts are not alternate-run predictions.

`veto-analysis.md` reviews97 failed attempts(PMLE54+ACE43):65 evidence-dominant,
15 prerequisites/transitions,13 alternatives/unstated constraints,4 conflicts.
These are analyst classifications of free text, not gold labels. All97 structured
reasons were empty. Preserve verifier and independent review.

Generation-only b28 telemetry:8,371,892 inclusive input,183,237 output,883,840
cached input(10.56% of generation input). OpenAI cached input is a subset of input;
Anthropic uncached/cache-read/cache-write are additive separate native fields.
Do not mix those raw ratios, and do not treat missing usage as zero.

## Coordinator A/B — not run here

Same checkout, bank, objectives,N12,seed1710,models/efforts,consistent distractors,
parallel1 and **all four independent gates for every candidate**
(`--full-gate-sample1`). Both arms retain attempts3. Flags off versus cache+
retrieval+stable-prefix on. No publication. Manifest records bank/code/replay
hashes, exact config/cap, commands, cold/warm cache, stage exits and wall time.
Normal execution requires **both exact frozen artifact hashes**, stable-prefix
mode, >=95% per-set recall, current source fingerprint and current default
config/cap. A stale, wrong-mode or arbitrary pair cannot authorize execution.

Exact safe command (prints only):
```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-retrieval-1019/content-pipeline && env -i PATH="$PATH" HOME="$HOME" uv run python scripts/run_retrieval_ab.py --bank /Users/switkowski/Projects/Testero/hq/drafts/ab-2026-10-17/existing-export.json --tag retrieval-1019-b --replay-report calibration/retrieval-2026-10-19/replay-b28-selected.json --replay-report calibration/retrieval-2026-10-19/replay-ace-b2-selected.json
```

Coordinator may append `--execute` using their approved credential environment
(omit `env -i` only when needed for injected keys). **This report is not permission
to run models or enable rollout.** `--allow-failed-recall` remains an explicit
exploratory override, not required for these current passing reports. Repeat
paired cohorts in both arm orders and inspect actual objective allocation.
`RESULTS-template.md` requires stage/provider usage per accepted, yield, all-gate
quality,Argon REVISE,cache accounting and wall time. A small N smoke test cannot
establish semantic noninferiority. Get fresh held-out receipt evidence before
considering rollout; selection reused both calibration sets.

Reproduce selected standalone reports with the ordinary replay CLI (no flags
needed; `--config selected-config.json` makes the same config explicit):
```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-retrieval-1019/content-pipeline
env -i PATH="$PATH" HOME="$HOME" uv run python scripts/replay_doc_retrieval.py \
  --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation/machine-learning-engineer-v5-b28-scaling-1018.json \
  --output calibration/retrieval-2026-10-19/replay-b28-selected.json
env -i PATH="$PATH" HOME="$HOME" uv run python scripts/replay_doc_retrieval.py \
  --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation/cloud-engineer-v5-ace-b2-1018.json \
  --output calibration/retrieval-2026-10-19/replay-ace-b2-selected.json
```

## Verification

Final clean-env pipeline suite: **2,134 passed,3 skipped,48 subtests**.
Standalone parity and verification details are in `frontier.md`.
Earlier full follow-up gate:2,133 passed,3 skipped,48 subtests;
focused final config/paired-gate suite:31 passed. Root npm test(1,183),lint,
typecheck and Docker passed on the initial PR; this follow-up changes pipeline
Python/reports only. Existing dependency deprecation warnings remain.
Independent bounded source review and fixes are in `frontier-review.md`.
