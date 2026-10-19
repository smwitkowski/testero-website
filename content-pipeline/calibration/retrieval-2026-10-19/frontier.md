# Two-set recall/size frontier — 2026-10-19

## Recommendation

Selected default configuration when `--verify-retrieval` is explicitly enabled:
**chunk2200,overlap350,top_k3,query_mode products,neighbors1,sectionsfalse,
budget130000characters (~32.5k doc tokens)**. All experiment flags remain off;
attempt cap3 unchanged. No live A/B or DB writes. Selection minimizes **mean
reconstructed verifier prompt tokens across91calls**, subject to >=95% quote
recall **on each** b28(60receipts) and ACE-b2(52receipts), among completed tested
configurations. It is not a proof of global optimum or a semantic-quality gate.

## Configuration comparisons

Budgets are doc chars/4, while mean prompt includes all signature instructions,
plan,scope and documentation. Reduction is pooled against full-source prompt.

| Configuration |Doc token cap|b28 recall|ACE-b2 recall|Mean prompt est.tokens|Prompt reduction|Paired gate|
|---|---:|---:|---:|---:|---:|---|
|base2200/300,all hits,objective|15k|46/60 (76.7%)|43/52 (82.7%)|17,137|80.1%|FAIL|
|base2200/300,all hits,objective|45k|59/60 (98.3%)|50/52 (96.2%)|45,193|47.6%|PASS|
|plan2200/350,k12,no expansion|35k|59/60 (98.3%)|49/52 (94.2%)|32,869|61.9%|FAIL|
|plan2200/350,k12,local windows|35k|59/60 (98.3%)|49/52 (94.2%)|33,914|60.7%|FAIL|
|plan2200/350,k12,neighbors1|35k|60/60 (100.0%)|50/52 (96.2%)|35,216|59.2%|PASS|
|products2200/350,k2,neighbors1|32.5k|56/60 (93.3%)|48/52 (92.3%)|27,972|67.6%|FAIL|

## Selected-policy budget frontier (current-source rerun)

| Configuration |Doc token cap|b28 recall|ACE-b2 recall|Mean prompt est.tokens|Prompt reduction|Paired gate|
|---|---:|---:|---:|---:|---:|---|
|selected products2200/350,k3,neighbors1|15k|44/60 (73.3%)|41/52 (78.8%)|17,061|80.2%|FAIL|
|selected products2200/350,k3,neighbors1|25k|52/60 (86.7%)|48/52 (92.3%)|25,984|69.9%|FAIL|
|selected products2200/350,k3,neighbors1|32.5k|57/60 (95.0%)|50/52 (96.2%)|30,883|64.2%|PASS|
|selected products2200/350,k3,neighbors1|35k|57/60 (95.0%)|50/52 (96.2%)|31,917|63.0%|PASS|
|selected products2200/350,k3,neighbors1|45k|58/60 (96.7%)|50/52 (96.2%)|33,157|61.6%|PASS|

Local refinement also tested110k/120k/125k/130k/135k/140k chars and k1/2/3/4/5/8/
12/all;125k selected-policy cap recovers57/60and49/52 (ACE94.23% fails),
130k57/60and50/52passes. Top2 saturates at56/60and48/52even135k; top1worse.
Small800/1200chunks,overlap300/500,objective/plan/product queries,larger top-k,
local6k windows and adjacent chunks are recorded in explicit config files/JSONL.
Initial exhaustive144configuration base grid was interrupted on expensive
800/500/all-positive cases;12completed only. Boundedbase48,query36,refine32,
short16,fine12,tight12 and current selected5completed rows. Overlapping rows are
not independent trials. **Only completed rows are evidence.** Earlier rows are
exploration; current selected sweep includes code+sweep+artifact provenance and
standalone replays are uncached authoritative checks. Resuming mismatched or
unfingerprinted rows is now refused.

## Standalone confirmation

| Set |Calls|Baseline est.tokens|Selected est.tokens|Reduction|Quote recall|
|---|---:|---:|---:|---:|---:|---:|
|b28|69|6,354,518|2,171,591|65.83%|57/60=95.00%|
|ACE-b2|22|1,493,274|638,750|57.22%|50/52=96.15%|
|Pooled|91|7,847,792|2,810,341|64.19% (2.79×)|107/112,each-set gate required|

Mean30,882.868 estimated prompt tokens/call, rounded independently per set.
Independent reviewer confirmed standalone vs selected tight-sweep **numerical**
parity across all7measured fields for both sets; source hashes differ because
DEFAULT_CONFIG/cap were subsequently selected. Current standalone fingerprint:
`2b18a0046d73055e3b0bcdd738f0c19c377ee54ff135e96c468ebd77acce40d3`. Both final reports match
current source/config/budget/stable-prefix mode. `frontier-selected.jsonl` reruns
same policy under the current source and corrected memoization, matching totals.

No quote-guided queries or injected receipts. Semantic entailment,quality,
provider tokens,caching,cost and tokens per accepted remain **unmeasured**.
Both sets are calibration after this sweep. No rollout approval is implied.
Original15kdoc-token target remains failed. Full-source receipts/independent
judges and default attempts3remain. Larger doc cap is an explicit coordinator-
requested frontier alternative, not a claim the original target succeeded.

## Ten-miss diagnosis

`miss-diagnosis.md` shows all10originalb28missing receipts fit complete raw chunks
from already fetched pages. **No chunk-boundary or absent-page miss.** Rank4
matches can still lose budget admission; long plans dilute concise pricing,
format,AutoML constraints and comparison-table text. Pumps/users terminology and
pipeline-definition/tutorial wording explain strongest lexical mismatches.
Neighbors + product queries help general capability context without receipt text.
Real HTML structure-aware extraction is a proposal, not implemented here;
6klocal windows were disclosed as a surrogate and are off in selected config.

## Verification

- Focused suite:31passed,including expansion/span/budget/config/query tests and
  paired A/B gate authorization with process calls stubbed.
- Final clean-env full suite: **2,134 passed,3 skipped,48 subtests** (116.80s).
  Command:`cd content-pipeline && env -i PATH="$PATH" HOME="$HOME" uv run pytest -q`.
- Both standalone replays exit0; normal dry A/B exits0, prints both arms with
  identical bank/objectives/N/seed/model/effort/consistent distractors/parallel1,
  all4judge gates and default3attempts. No --execute or model call made.
- Independent review fixed alias/time memoization provenance,resume source/
  artifact/sweep hashing,stable-prefix mode and exact frozen pair gate. Current
  bounded source review reports no remaining concrete config-wiring blocker.
