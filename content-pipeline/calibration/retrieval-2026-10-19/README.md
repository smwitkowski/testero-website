# Documentation retrieval experiment — 2026-10-19

**Draft / rollout blocked.** All new switches are off by default. No live models,
production requests or DB writes were run. The 3–5× tokens-per-accepted target is
**not demonstrated**. Offline replay does not rejudge semantic support or quality.

## Implemented
- `--doc-cache`: local `.cache/documentation/` official-document snapshots keyed by
  requested URL, original fetched timestamp and SHA256. TTL **7 days**, future,
  stale, malformed and corrupt snapshots miss; a failed fetch never receives stale
  evidence. Atomic replace, bounded **32 MiB** JSON reads, failed disk writes do
  not discard fresh network results. Existing per-run single-flight cache remains.
- `--verify-retrieval`: original-span chunks (**2,200 characters**, **350 overlap**),
  stable IDs from URL/hash/span, pure-Python BM25, separate decision/constraints,
  best-action and each distractor action/reason queries. Source intro anchors,
  overlap merging and a **60,000-character** doc budget (at most about **15k**
  chars/4-estimated doc tokens). Frozen objective prefix up to **8,000 characters**.
  These constants were selected by transparent b28 calibration, not held-out proof.
- `--verify-stable-prefix`: verifier instructions/output contract, frozen objective
  docs, stable objective text, then variable candidate passages/scope/plan. Same
  typed signature order for Codex CLI and native DSPy adapters. Actual cache-hit
  gains are unknown; no gateway cache control is assumed.
- `--decision-attempts 1|2|3`: explicit total cap, default **3 unchanged**. No cheap
  semantic precheck or default cap reduction: evidence gaps dominate, and cap2
  loses **2 of b28's 8** accepted candidates in static replay. Adaptive scheduling
  means the saved work is not a forecast of an alternate live run.

Receipts must exist in one selected original span **and** pass original full-source
URL/hash/quote checks. Full immutable sources stay available for writer windows,
mechanical receipts and independent judges. No fabricated text, proof-quote rank
injection, automatic approval, silent full-context fallback or gate relaxation.
The first successful objective prepare freezes its prefix per run; parallel
admission timing may change which valid source snapshot wins. A/B uses parallel1.

## Final reproducible b28 replay
Artifact SHA256: `2c50b82e9d1c10493d949a24bdb9d58d2a2955e8bc634d888aa794ca83b7699c`.
Scope reconstruction uses the recorded candidate index and rejects objective drift.

| Budget | Verify calls | Est. baseline prompt tokens | Est. treatment prompt tokens | Est. prompt reduction | Quote recall |
|---|---:|---:|---:|---:|---:|
| 60k chars (~15k doc tokens) | 69 | 6,354,518 | 1,182,871 | 81.39% (5.37×) | **50/60 = 83.33% — FAIL** |
| 180k chars (~45k doc tokens), diagnostic only | 69 | 6,354,518 | 3,171,914 | 50.08% (2.00×) | **59/60 = 98.33%**, outside requested budget |

These are **characters/4 estimates of reconstructed prompts**, not provider token
counts, cost savings, tokens per accepted, or measured provider caching. Receipts
come from 15 full-source mechanically passing proofs; failed proofs have empty
reasons, so 54 veto attempts supply no recall denominator. The general replay
reports all proposed reasons (including invalid if present); b28 has zero invalid.
The 60 receipts are calibration, not held-out validation. JSON reports list every
miss by option/URL/quote and every selected chunk ID. The high-budget recall boolean
alone cannot authorize A/B: runner also requires exactly60k budget and current code
fingerprint. The 95% recall goal at 8–15k doc tokens remains **unmet**.

Exploratory variants, no proof-quote injection: no-anchor initial 48k ~68%; alternate
chunk sizes at60k 73–83%; naive source diversity34/60 (56.7%) was reverted. Final
anchors + merged overlaps50/60. No semantic or true token comparison was run.

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-retrieval-1019/content-pipeline
env -i PATH="$PATH" HOME="$HOME" uv run python scripts/replay_doc_retrieval.py \
  --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation/machine-learning-engineer-v5-b28-scaling-1018.json \
  --output .cache/generation/replay-b28-current.json
```

## Veto findings and token interpretation
`veto-analysis.md` contains 97 failed attempts from PMLE54 + ACE43:
**65 evidence-dominant**, **15 prerequisites/transitions**, **13 alternatives or
unstated constraints**, **4 conflicts**. These are analyst classifications of
recorded free-text reasons, not gold labels; all97 structured reasons were empty.
It includes failed quote anchors and passing distractor controls. Keep verifier
and independent semantic review. Cap2 removes17 PMLE third attempts but loses two
accepted questions; ACE third attempts contribute eight proofs/two accepted.

Generation-only b28 telemetry: 8,371,892 inclusive input,183,237 output,883,840
cached input (**10.56%** of generation input). Do not divide mixed-provider raw
cache totals by raw input. OpenAI input includes cached input; Anthropic uncached,
cache-read and cache-write categories are separate. Keep known-usage coverage and
provider-native fields; missing usage is not zero.

## Coordinator A/B — not run here
Same checkout with all flags off versus all flags on, same local bank, objectives,
consistent distractor policy, N12, seed1710, same models/efforts, parallel1 and **all
four gates for every candidate** (`--full-gate-sample 1`). No production publication.
The script prints commands by default, records exact commands, implementation
hash, bank hash, replay hash, cache warm/cold state, per-stage exit codes and wall
time on execution. It never loads env files or obtains credentials; coordinator
supplies normal documented environment. Run paired cohorts in both orders and
inspect actual objective rotations/allocation, not just initial seed.

Exact safe command (prints only):
```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-retrieval-1019/content-pipeline && env -i PATH="$PATH" HOME="$HOME" uv run python scripts/run_retrieval_ab.py --bank /Users/switkowski/Projects/Testero/hq/drafts/ab-2026-10-17/existing-export.json --tag retrieval-1019-a --replay-report calibration/retrieval-2026-10-19/replay-b28.json
```

To make an **exploratory live** run despite the failed recall gate, coordinator must
explicitly append `--execute --allow-failed-recall` to that command, using their
normal credential environment (omit `env -i` only if required for injected keys).
This is not approval to run or roll out. Normal `--execute` refuses missing, stale,
failed or wrong-budget replay; even a passing replay needs independent quality A/B.
`RESULTS-template.md` specifies stage tokens per accepted, yield, gate rates,
Argon REVISE, cache accounting and wall time; measure ≥3× improvement with no quality
loss before proposing enablement. Small N is a smoke test, not noninferiority proof.

## Verification
- Clean-env pipeline pytest: completed full gate **2,126 passed, 3 skipped**,
  48 subtests; after adding replay-index/A/B freshness/integration coverage,
  focused suite **26 passed**. A second full gate is in progress at PR creation;
  its final result will be recorded before handoff.
- Root clean-env npm test, lint, typecheck and Docker build passed. Docker reports
  existing `SecretsUsedInArgOrEnv` warning for its placeholder ENV; unchanged.
- Independent bounded source review found no remaining concrete blocker after
  prefix, source alias, chunk progress, replay scope and fingerprint fixes.
