# Part B: independent offline evaluation

No worktree edits, model/API/environment/prod calls. Sources and SHA256 are in `evaluation.json`. `anchor-feasibility.json` preserves exact analyst claim IDs, URLs, source hashes and spans. `evaluator-schema-proposal.json` is a proposed record contract, not a measured evaluator.

## Denominators

| Saved batch | candidates | plans/attempts | actual proofs | failed proofs/vetoes | passed proofs | eventual proof-pass candidates | accepted |
|---|---:|---:|---:|---:|---:|---:|---:|
| machine-learning-engineer-v5-b28-scaling-1018 | 30 | 69 | 69 | 54 | 15 | 15 | 8 |
| cloud-engineer-v5-ace-b1-1017 | 15 | 23 | 22 | 8 | 14 | 14 | 7 |
| cloud-engineer-v5-ace-b2-1018 | 15 | 22 | 22 | 9 | 13 | 13 | 9 |
| cloud-engineer-v5-ace-b3-1018 | 15 | 28 | 28 | 15 | 13 | 13 | 4 |
| cloud-engineer-v5-ace-b4-1018 | 15 | 25 | 21 | 11 | 10 | 10 | 4 |
| baseline | 12 | 27 | 27 | 21 | 6 | 6 | 0 |
| treatment | 12 | 36 | 36 | 35 | 1 | 1 | 0 |

Historical total: 90 candidates,167 plans,162 actual proofs,97 vetoes,65 proof passes,65 eventual proof-pass candidates,32 accepted. **Correction to historical narrative:** 70 was inferred as167−97; five attempts have no proof at all, so cannot be counted as passes. Per-artifact no-proof attempts in table order:0,1,0,0,4 (baseline0,treatment0). Passed proofs are attempt-level; accepted is candidate-level. Eventual proof-pass candidate counts are separately computed, not assumed equal to attempt passes. Missing-proof identities: ACEb1 candidate3 attempt2; ACEb4 candidate1 attempt2,candidate7 attempt1,candidate8 attempt1,candidate12 attempt1. Their near-duplicate checks passed; no proof outcome inferred.

Live total:24 candidates,63 plans (27 baseline,36 treatment),63 proofs,56 vetoes,7 passes/eventual proof-pass candidates,0 accepted. External judge pass:5 baseline,0 treatment. These are saved artifact outcomes, not publication or new counterfactual results.

## All1010 ledger rows

515 documentation:67 supported,41 partial,406 not_found,1 contradicted.304 judgment:39 supported,6 partial,259 not_found.191 scenario:all stipulated supported. Aggregate297 supported,47 partial,665 not_found,1 contradicted. Scenario support is not documentation evidence. not_found means no entailing support identified in this attempt, not global impossibility.

I checked all119 recorded support spans:119/119 match same saved URL, UTF-8 source SHA and exact Unicode [start,end) text.77 best_action/reason rows have recorded support:47 documentation-supported,23 documentation-partial,6 judgment-partial,1 documentation-contradicted. This proves retrospective anchor feasibility for some narrow claims, **not precheck catchability** or full-plan entailment. No source sections or planner commitments were recorded in these plans; all63 have only the original eight plan fields.

## What can be supplied before full verification

Planner can commit best_action plus each of three mistake reasons to an official page URL and concrete section. Each commitment needs a target_claim and documentation relation. A reason may combine a documented capability with a scenario comparison; label the relation honestly, do not claim that scenario inference is a documentation quote. Atomic claims may need multiple anchors. Existence/tutorial listings do not prove comparative cost,latency,uniqueness,negative capabilities,or prerequisites.

The saved ledger contains concrete feasible capability anchors (e.g. baseline candidate1 attempt3 BigQuery implicit-factorization tutorial) but its composite best_action is partial. A planner must either narrow the claim, supply the missing premise, or explicitly leave the ambiguity unresolved. Framework-specific claims need relevant official framework docs rather than unrelated Google product existence pages. No new URL/content was looked up here.

Cheap post-retrieval check can deterministically block missing commitments, nonofficial/unfetched URLs, sections not resolvable in the same fetched page/text, and explicitly unresolved issues. It cannot infer that a located section entails the claim. Do not add keyword-overlap semantic gates. Replan within the existing three total attempts; no fourth attempt and no bypass of unchanged full-document verifier. Official-domain policy and exact section-normalization semantics must be declared in implementation.

## Transferable flags and unknowns

All63 plans lack newly introduced metadata: status must be historical_not_evaluable, not blocked/caught. Taxonomy65 missing evidence/15 prerequisites/13 alternatives/4 incompatibility describes recorded veto causes, not cheap-gate outcomes. Even the single independently annotated contradiction requires semantic interpretation; it is not automatically a deterministic anchor-resolution catch. No justified catch count or false-block count follows from these inputs. Real ≥40% veto catch and ≤5% false block remain unmeasurable.

## Reproducible held-out live A/B proposal (not run)

Freeze plan schema, checker,official-domain/section matching policy,full verifier and model settings before collecting unseen objective-balanced candidate pairs. Randomize paired candidates to control/treatment; retain every attempt and source hash. Maximum3 attempts per candidate. Control stays unchanged; treatment adds commitments/precheck and unchanged full-doc verify. Log tokens,wall time,blocked/replanned attempts,proof and independent-judge outcomes,accepted yield.

On an independently sampled shadow audit of **all blocked attempts** (or a predeclared random sample with weights), run the same full-doc verifier despite the block, without allowing that shadow result to bypass the treatment gate. At attempt level: catch fraction=blocked AND shadow-full-verifier-fail / all shadow-full-verifier-fail; false-block fraction=blocked AND shadow-full-verifier-pass / all shadow-full-verifier-pass. Evaluate all passed prechecks too, otherwise recall denominator is unavailable. Report paired candidate-level eventual proof/accepted yield separately; never mix attempt and candidate denominators. Include uncertainty intervals; insufficient passing attempts means inconclusive, not ≤5% achieved. For perspective,zero false blocks in59 independently sampled passing attempts gives about a5% one-sided95% binomial upper bound; clustering by candidate requires an appropriate paired/cluster analysis. No live experiment authorized or run by this report.
