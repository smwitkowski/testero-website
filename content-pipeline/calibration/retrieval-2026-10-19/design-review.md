# Retrieval integration design review — 2026-10-19

Read-only source review. No tests, imports, model calls, environment reads or database operations were performed. Recommendations below are proposed seams, not implemented flags or measured improvements.

## Minimal seams

1. **Default-off disk cache:** extend `DocumentationCache` with explicit optional disk configuration; retain the existing run-local Future/singleflight layer and deep-copy returns. Construct it once in `generate_pmle_questions.main`; `generate_all_domains` already forwards the same CLI. Cache successful discovery and fetched full records separately. Discovery keys must include exact objective ID/text, services, result count and discovery/query version; fetch keys use the approved requested URL and extraction/schema version. TTL must be explicit and measured from the original fetch timestamp, not reset on a read. Validate host rules, required fields and SHA-256 before admitting a disk record. Treat corrupt/expired/incompatible entries as misses; never persist transient failures across runs. Atomic replacement with unique temporary names prevents parallel writers from sharing `.tmp`. Keep final-URL conflict detection across disk and network hits. Preserve requested/final URL bindings and original retrieval time. Version caches when `content_node` extraction changes. Local JSON is not cryptographic proof of an HTTP fetch; do not describe hash integrity as authenticated provenance.

2. **Per-option BM25 chunks:** put a pure selector/formatter alongside `documentation_context`; do not replace `sources` with snippets. First validate full records with `documentation_context`. Split into deterministic original-text character spans with overlap, rank using the best action plus decisive constraints and each mistake's action plus scenario reason. Reserve a budget for each of A-D, deduplicate selected spans, break ties by stable source/span order, and preserve source URL, original timestamp, full-text hash and offsets. No stemming/normalization may alter rendered text. Tokenization can normalize only scoring terms. Chunk assembly must not join separated spans as if contiguous. Fetching already does per-option discovery; this change should target **verification input** in `verify_decision`, where full documents currently dominate, not silently remove option discovery. Keep final judge/full artifact sources unchanged. Writer already has receipt-centered ±8000-character merged windows; leave it unchanged initially. Missing lexical matches are not permission to invent support. Explicitly record whether empty/weak selection fails closed or uses full-text fallback; count fallback use so token savings are not overstated.

3. **Stable prefix:** CLI `signature_prompt` already serializes JSONAdapter system instructions before variable inputs. DSPy `_predict` uses `CompletionCaptureAdapter` (ChatAdapter), not that same JSON serializer. Add a static, versioned instructions prefix through shared signature/adapter policy, not a candidate-specific prefix and not only the CLI string. Keep schema/field descriptions and policy-specific strict/consistent semantics intact. Variable objective, plan, fetched sources, feedback and scenario history must remain after static instructions. Test the actual CLI serialization and DSPy adapter messages independently. Do not change JSON-vs-Chat parsing as part of prefix work. Frozen exported external-judge prompts must remain verbatim. Stable bytes are testable; provider prompt-cache hits are not guaranteed, especially for subscription CLIs. Retrieval timestamps and text digests are variable provenance and must not be removed merely to improve reuse.

4. **Retry cap:** parameterize the decision loop's `range(3)` with a bounded explicit CLI option, default 3 to preserve behavior; freeze the chosen value in artifacts even with `--plan-only`. Use terminology “decision attempts” including the initial plan (cap 1 means no replacement). Treatment can request 2 or 1 explicitly. Preserve repeated-decision veto, all prior veto feedback, stop-event behavior and independent evidence gates. Do not conflate this cap with the fetch's typed transient retry, the one citation repair, transport retries or DSPy adapter behavior. `CompletionCaptureAdapter` already avoids ChatAdapter's automatic JSON fallback.

## Provenance and policy risks

- `check_evidence` requires A-D exactly once, URL membership in explicit aliases, original full-source hash and timestamp, <=300-character case-sensitive quotes with whitespace normalization only. Keep this checker on full records. A receipt can pass membership while failing semantic support: independent evidence review remains mandatory.
- Do not hash only an excerpt and label it full-source SHA-256. A selected context is a view with offsets; the underlying fetched source is immutable. Test repeated quotes, quote-crossing chunk boundaries, Unicode/whitespace, aliases, same-final-URL conflicts and mutation isolation.
- Strict versus consistent distractor policy is already frozen at scope, proof and external review boundaries. Consistent still requires documented behavior anchoring B-D inference, direct key support and fail-closed unsupported claims. Retrieval must not weaken those requirements or change objective/style policy.
- Retrieval source text is untrusted data. Preserve existing no-tools/structured-output restrictions and independent models. No drafts may be published; no database writes are needed for calibration.

## Same-branch A/B recommendation

The reference `hq/tools/run-ab-generate.sh` selects two different worktrees, reads a trashed `.env`, and pipes output without preserving the generator exit status. Do not copy those aspects. Use one frozen branch/commit and the same current worktree for both arms, with credentials provisioned externally through the approved environment. Record commit and effective flags; use separate new artifact/request paths under `.cache/generation/`. Never overwrite external ingestion journals.

Suggested **proposed** arm flags (names to finalize with implementation):

- baseline: disk cache off, full-document verifier context, stable-prefix experiment off, `--decision-attempts 3`.
- treatment: explicit disk cache directory/TTL, BM25 verifier context and fixed chunk budgets, stable-prefix experiment on, explicit treatment attempt cap.
- both: `--distractor-evidence consistent --dry-run --model codex --judge-model external --argon-gate --parallel 1 --gen-effort high --cite-effort medium`, identical cert, candidate count, objective order, seed, difficulty and hashed existing-question export. The reference script omits distractor mode and therefore currently defaults to strict; changing only one arm to consistent would confound results.

Same seed fixes objective planning offsets, not stochastic LM output or adaptive rotation/history. Freeze and compare initial plans, actual objective allocations and rotations; use paired repeated runs or alternating arm order. For cache measurements, distinguish cold and warm treatment runs and do not warm only treatment invisibly. A combined treatment estimates the bundle, not each feature's causal effect. A tiny 2x2 or sequential ablation is preferable if the question is which optimization works.

Capture raw generator exit codes separately from filtered console summaries; partial-candidate failure is expected to return nonzero and is still useful evidence. Report generator wall time, per-stage calls/tokens where actually available, discovery/fetch/cache-hit counts, source/context characters, attempts, verifier vetoes, citation repairs, duplicate failures, external-ready count and independent final accepted count. Report cost/time per independently accepted question, not per exported request. Missing usage is unknown, not zero; CLI cached-input counters must be observed before claiming prompt-cache savings. Keep key-position, template/style and evidence failures visible, with no policy relaxation. No live A/B was run in this review.

## Focused offline validation

Extend `test_doc_cache.py` for disk off/no filesystem touch, TTL/corruption/version/hash misses, atomic concurrency and final-URL conflicts; retain singleflight/failure semantics. Extend `test_writer_efficiency.py` or a focused retrieval test for deterministic original spans, A-D budget coverage and full-source immutability. Extend `test_decision_first_v4.py`/`test_pipeline_yield.py` for cap 1/2/3 and unchanged default 3. Extend `test_cli_models.py` plus adapter-message tests for static-prefix ordering and unchanged typed schemas. Existing tests explicitly exercise third-attempt success and failure; do not silently rewrite those expectations for default behavior.


## Final bounded static review follow-up

Concrete findings were fixed: replay now selects the frozen scope by candidate
index (rejecting objective drift), and live A/B normal approval requires a current
hash of replay/retrieval/planner/CLI source bytes plus the exact60k budget and95%
recall. Manifest saves replay path/hash. No remaining concrete blocker found in
this bounded static review; no claim of live semantic equivalence. Final50/60
recall remains rollout-blocked. Receipt population is explicitly proposed reasons;
b28's60 reasons all have a passing original full-source mechanical check.
