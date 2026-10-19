# Frontier implementation review (read-only)

Reviewed `shared/doc_retrieval.py`, replay, sweep, paired runner, and relevant caller/tests. No models, DB, environment files, or source edits. Defaults are still being selected; the current 60k default is not itself a finding.

## Findings

1. **Sweep rank memoization can return another source record's provenance (medium).** `sweep_doc_retrieval.py:35-40` keys ranks by chunk IDs and query, but IDs include URL/text hash/span only, not `requested_url` or `retrieved_at`. The cached value is a list of old `Chunk` objects. Identical text fetched with another alias/time therefore returns old metadata in later replay calls, unlike uncached live BM25. This can also change alias-based `quote_in_chunks` recall. The chunk cache includes alias/time correctly; the rank cache loses that distinction. Cache ranks/IDs and resolve to current chunks, or include complete chunk identity. This is a conditional code-path defect, not a claim that current artifacts contain such collisions.

2. **Sweep resume accepts stale results (medium).** `sweep_doc_retrieval.py:71-73` skips configurations using only config/budget. Neither rows nor resume checks bind artifact hashes or implementation hash. Reusing an output after source changes or input-artifact changes silently mixes old results with new results and skips needed recomputation. Use a fresh output for each implementation/input pair today, or bind/validate that identity before resume. This matters during an active frontier iteration.

3. **Paired replay gate does not bind the expected input cohorts or prompt mode (medium).** `run_retrieval_ab.py:74-80` requires two distinct reported artifact hashes but never compares them with expected b28/ACE-b2 hashes. Any two other artifacts can pass. `replay()` also accepts `stable_prefix=False` but does not record that choice; the paired runner always enables stable prefix. Such a replay has the same implementation/config/budget gate fields. Record and check prompt mode; bind expected cohort digests (or explicitly document that any two cohorts are accepted). Current default replay calls do use stable prefix, so this is an acceptance-gap finding, not evidence the current reports are wrong.

## Checks that looked correct

- Replay indexes exact frozen objective scope and rejects objective mismatch.
- Retrieval selection does not receive proof receipts; receipts are only scored afterward.
- Prefix source records remain available when candidate sources change; same-URL conflicting text is rejected across prefix/current sources.
- Source excerpts retain exact text spans and source hashes; context assembly reserves room for headers and bounds merged excerpts.
- Gate compares replay config and budget to imported live defaults, and hashes retrieval/prompt source files. No hard-coded wrong-config gate beyond the intentionally pending default selection was found.
- Query/neighbor/section settings are passed into candidate selection. Objective-prefix selection intentionally uses a simple objective-only query and does not inherit candidate expansion/top-k.

No runtime reproduction was executed; findings above are source-level independent review. No redesign proposed.

## Bounded patch follow-up

Reviewed coordinator patches after the initial review:

- Rank key now includes `(chunk.id, requested_url, retrieved_at)`: resolves the identified cached-record mismatch for valid frozen inputs.
- Replay reports now record `stable_prefix`; paired gate checks it and the exact two expected artifact hashes, in addition to current config/budget/source identity. Expected digest constants were not independently checked against original artifacts here.
- Sweep rows now bind retrieval/replay/prompt implementation hashes, artifact paths/digests, and stable-prefix mode; resume rejects mismatches/missing provenance. **Remaining narrow gap:** sweep implementation itself (`scripts/sweep_doc_retrieval.py`) is absent from that hash. A subsequent sweep-only memoization change can still resume old rows. Include the sweep source in sweep provenance (separate from the replay gate hash if necessary).
- **Blocking at inspection:** `run_retrieval_ab.py` line 76 had an unmatched `(` introduced in `and(report...`; `ast.parse` reported `"'(' was never closed"`. Parent notified immediately. No execution attempted.

Old provenance-free exploration outputs are not validated by this follow-up. Standalone uncached confirmation of the chosen point remains necessary and is outside this read-only review.

### Syntax correction recheck

Re-read all four named source files after correction: `ast.parse` succeeds for each. Paired gate boolean expression now correctly requires stable-prefix true, pass flag true, matching source hash, numeric recall >= .95, current budget, and current config for each of the exact two cohort hashes. No additional actual config-wiring defect found in this bounded recheck. Sweep-source omission from sweep provenance remains as noted above. No frontier result or selected default is certified by this syntax/source check.

## Selected-point independent report comparison

Read both completed standalone reports and the unique matching `frontier-tight.jsonl` row for 2200/350, top_k=3, products, neighbors=1, sections=false, budget=130000.

- b28: 57/60 receipts, 69 calls, 2,171,591 estimated treatment prompt tokens.
- ACE-b2: 50/52 receipts, 22 calls, 638,750 estimated treatment prompt tokens.
- Exact equality for both sets across recall, recovered/count, replay call count, treatment/baseline token totals, and reduction. Combined mean: 2,810,341 / 91 = 30,882.86813186813 estimated prompt tokens/call.
- Both standalone reports: stable_prefix=true; recall_gate_passed=true; exact selected config and 130000 budget. Their implementation hash `2b18a0046d73055e3b0bcdd738f0c19c377ee54ff135e96c468ebd77acce40d3` equals the independently recomputed current four-file replay/retrieval/prompt hash.
- Independently hashed both original artifact files named in frontier provenance; hashes match the frontier and standalone report cohort digests.
- Current source declares DEFAULT_CONTEXT_CHARS=130000 and DEFAULT_CONFIG=RetrievalConfig(top_k=3, query_mode="products", neighbors=1), retaining 2200/350/sections=false dataclass defaults.
- Frontier row has older implementation hash `ade1f98a…` and no sweep hash; it is historical search evidence, not a current-source gate artifact. Exact standalone parity above is specifically numerical parity, not source-hash parity.
- Current sweep source now includes `sweep_sha256` in provenance, resolving the remaining sweep-source resume gap for newly written outputs. Historical outputs remain historical.

This comparison reads completed offline artifacts and source; it does not independently rerun retrieval or establish live model/quality gains.
