# Miss diagnosis — offline recall frontier (2026-10-19)

## Scope and method

Read-only inspection of the original PMLE b28 artifact and the **10 missing receipt occurrences** in `replay-b28.json` (50/60 recovered at 60k chars). Original SHA256: `2c50b82e9d1c10493d949a24bdb9d58d2a2955e8bc634d888aa794ca83b7699c`.

Repository imports ran through `content-pipeline`'s `uv run python`; no network, model, database, or environment-file access. Source offsets below are zero-based character offsets in the immutable recorded `text`; source indices are zero-based inside that candidate/attempt's `sources`. They are not HTML DOM offsets.

Ranks are calculated BM25 ranks over **all raw chunks in that attempt**, before prefix/anchor exclusions, using the unchanged chunker (2200 chars/350 overlap). Historical selected IDs come only from `replay-b28.json`. The historical query set is reconstructed exactly as **objective-mode ranks with the final objective-only entry removed**: historical code prepended objective text only to the first composite query. The current objective mode additionally appends an objective-only query. Neither rank vector is an admission-order trace: prefix/anchor exclusion, duplicate skipping, merged-span marginal cost, and the remaining budget determine admission. Merged selected spans have different IDs from constituent raw chunks; missing receipts, not raw-ID absence alone, establish omission.

Rank vectors in the detailed entries use plan-only queries in this order: **decision+constraints, best action, constraints, B action, C action, D action, B reason, C reason, D reason**. `None` means zero lexical score. The objective-mode vector uses objective+decision for its first entry, the same next eight entries, then the objective alone. Letter labels follow the plan's best action=A and ordered mistakes=B/C/D. Quotes are used only to locate diagnostic targets; no receipt text is supplied to ranking queries.

## Findings

All 10 receipts exist in at least one complete raw chunk; **zero are chunk-boundary failures**. All target pages were already fetched. Thus none proves a missing-fetch/wrong-page acquisition failure. Several sources are broad comparisons or tutorials rather than narrow reference pages; ranking and allocation, not availability, lose their useful paragraphs. No observed miss requires adding receipt text to a query.

## 1. Candidate 3, attempt 3, option A

- URL: `https://docs.cloud.google.com/architecture/choose-agentic-ai-architecture-components`
- Receipt: “Cost: Features a pay-per-use, request-based pricing model that scales to zero, which makes it highly cost-effective for models with sporadic or variable traffic.”
- Location: `SOURCE 0 len 41093 offset 28237 hash 18d086e0d847eb15a16b92bcf8c8948a12e29ca5e423c0004b1a5d20b4e425c5`
- Diagnosis: Rank/budget loss on an already fetched cross-product architecture page; the relevant Cloud Run pricing paragraph is deep in a mixed model-hosting comparison, not its intro.
- Containing raw chunk `208a7f38a6731484e75e418f`, span `[26939:29133]`; plan-query ranks `[8, 19, 7, 25, 103, 38, 34, 70, 61]`; objective-mode ranks `[8, 19, 7, 25, 103, 38, 34, 70, 61, None]`.

## 2. Candidate 3, attempt 3, option D

- URL: `https://docs.cloud.google.com/kubernetes-engine/docs/resources/autopilot-standard-feature-comparison`
- Receipt: “In Standard, you pay for node capacity regardless of whether Pods use the resources.”
- Location: `SOURCE 11 len 10804 offset 8739 hash b447f691f0f401bf6e5075076acf6d42e2eab0bf27f0acf08b53556990b1b788`
- Diagnosis: Rank/budget and source-coverage loss: no raw chunk ID from this comparison page appears among the recorded selected IDs. Node-pricing language matches the D reason better than the long deployment action.
- Containing raw chunk `64a1904275c3fbea4a1eea5e`, span `[7298:9401]`; plan-query ranks `[109, 54, None, 78, 123, 11, 6, 63, 3]`; objective-mode ranks `[109, 54, None, 78, 123, 11, 6, 63, 3, None]`.

## 3. Candidate 5, attempt 1, option A

- URL: `https://docs.cloud.google.com/bigquery/docs/partitioned-tables`
- Receipt: “When you write data to the table, BigQuery automatically puts the data into the correct partition, based on the values in the column.”
- Location: `SOURCE 4 len 17310 offset 4289 hash c52b6c5ec51c16dac0187a3d4298a314d4a95421a0573a416b8b3d4c62586de4`
- Diagnosis: Rank/budget loss despite rank 4 for both best action and ingestion-partition distractor. Intro coverage does not preserve the specific time-unit-column subsection.
- Containing raw chunk `221876cc43ed16267f014d79`, span `[3483:5645]`; plan-query ranks `[66, 4, 74, 4, 14, 70, 19, 11, 39]`; objective-mode ranks `[87, 4, 74, 4, 14, 70, 19, 11, 39, 111]`.

## 4. Candidate 6, attempt 2, option B

- URL: `https://docs.cloud.google.com/bigquery/docs/s3-transfer`
- Receipt: “For File format choose your data format (newline delimited JSON, CSV, Avro, Parquet, or ORC).”
- Location: `SOURCE 0 len 20326 offset 5773 hash 46ceffd47361eeb13aad55051af720477fc66a733b1eb4dc633ea4728b02a8b6`
- Diagnosis: Rank/budget loss: supported-format list is buried in setup instructions. The long S3 video action promotes generic transfer material; the reason query improves its rank to 6.
- Containing raw chunk `f7f04a9863e05a0adf6c61c5`, span `[5423:7526]`; plan-query ranks `[4, 34, 15, 26, 57, 14, 6, 93, 25]`; objective-mode ranks `[7, 34, 15, 26, 57, 14, 6, 93, 25, 16]`.

## 5. Candidate 14, attempt 1, option D

- URL: `https://docs.cloud.google.com/architecture/ml-on-gcp-best-practices`
- Receipt: “Agent Platform Pipelines provides serverless execution for DAGs that are generated by Kubeflow and TensorFlow Extended (TFX).”
- Location: `SOURCE 1 len 36888 offset 29210 hash 0ae6f85f05c24ef37453b3224e82d689ca82a77497afe0293bcf527cb9a8f487`
- Diagnosis: Rank/budget loss: workflow overview on a long architecture page ranks 4 only for the pipeline action. Other ML products and custom-training vocabulary compete across the same page.
- Containing raw chunk `d703f36a81d06c3cee96640c`, span `[27838:29833]`; plan-query ranks `[92, 36, 95, 100, 160, 4, 142, 38, 101]`; objective-mode ranks `[35, 36, 95, 100, 160, 4, 142, 38, 101, 11]`.

## 6. Candidate 20, attempt 1, option B

- URL: `https://docs.cloud.google.com/compute/docs/instances/provisioning-models`
- Receipt: “You incur standard pricing for compute instances.”
- Location: `SOURCE 0 len 14270 offset 4728 hash 5d5347a2577ebe4dfa3171003e11d69e4e582014f6644f07f0f4fd5bffbbc23c`
- Diagnosis: Rank/budget loss in a flattened comparison table. “Standard pricing” is short; generic compute/training vocabulary dominates action queries. Retain column/row context when interpreting this receipt.
- Containing raw chunk `a4b6a780f1b48722127f8c2a`, span `[3597:5770]`; plan-query ranks `[14, 95, 6, 75, 98, 94, 17, 112, 23]`; objective-mode ranks `[34, 95, 6, 75, 98, 94, 17, 112, 23, 79]`.

## 7. Candidate 20, attempt 1, option D

- URL: `https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/start/training-methods`
- Receipt: “You must target one of AutoML's predefined objectives.”
- Location: `SOURCE 4 len 5920 offset 3414 hash 7b23a3f58819ad8364a46ae092ddecfc7b03eea3d4293df9db784441ecfb3a45`
- Diagnosis: Rank/budget loss in a training-method comparison table. The limitation is strong for the AutoML reason (5), weak for the full AutoML action (7); header/column context matters.
- Containing raw chunk `789a66bafbcd0fe3a5dd060b`, span `[1786:3968]`; plan-query ranks `[16, 49, 13, 88, 83, 7, 22, 4, 5]`; objective-mode ranks `[2, 49, 13, 88, 83, 7, 22, 4, 5, 2]`.

## 8. Candidate 26, attempt 1, option D

- URL: `https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/pipelines/continuous-training-tutorial`
- Receipt: “A pipeline is a description of an MLOps workflow as a graph of steps called pipeline tasks.”
- Location: `SOURCE 4 len 38331 offset 18010 hash 28e8a9c5bef3cd3b19ca6e7dab814ba3ca3da3e44aa833a0656e9abcdc8ef131`
- Diagnosis: Largest semantic mismatch: a general pipeline definition in a long tutorial ranks 27 even for the pipeline action and 39 for its reason; independent-job/distributed-gradient wording is unlike the short definition.
- Containing raw chunk `eeee2a1036b1be35252db412`, span `[17466:19148]`; plan-query ranks `[19, 51, 81, None, 62, 27, 18, 43, 39]`; objective-mode ranks `[55, 51, 81, None, 62, 27, 18, 43, 39, None]`.

## 9. Candidate 28, attempt 1, option C

- URL: `https://docs.cloud.google.com/architecture/ml-on-gcp-best-practices`
- Receipt: “Nearly all aspects of training and serving a model, like choosing an architecture, hyperparameter tuning, and provisioning machines, are handled for you.”
- Location: `SOURCE 3 len 36888 offset 4663 hash 0ae6f85f05c24ef37453b3224e82d689ca82a77497afe0293bcf527cb9a8f487`
- Diagnosis: Rank/budget loss: concise AutoML capability summary ranks 4 for its reason but 12 for its action. Long custom-runtime plans over-weight unrelated dependencies and deployment terms.
- Containing raw chunk `cad3f5abce4da1bb048cf595`, span `[3667:5781]`; plan-query ranks `[22, 26, 12, 50, 12, 77, 70, 4, 31]`; objective-mode ranks `[22, 26, 12, 50, 12, 77, 70, 4, 31, 21]`.

## 10. Candidate 29, attempt 2, option A

- URL: `https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/tabular-data/bp-tabular`
- Receipt: “Similarly, if you want your model to be tuned to make generalized inferences about new users, then make sure that data from a specific user is only contained in a single split of your training data.”
- Location: `SOURCE 1 len 16703 offset 3595 hash 7802df0e75f650151034077d5993e79016e6f7e43f2f1a81f2d10712ec7818da`
- Diagnosis: Rank/budget loss with domain-language mismatch (pumps versus users); same quote is fully contained in two overlapping chunks, so this is explicitly not a boundary failure.
- Containing raw chunk `0c2e5d353e42a32c16c97398`, span `[1688:3794]`; plan-query ranks `[25, 39, 18, None, 123, 15, 71, 36, 6]`; objective-mode ranks `[34, 39, 18, None, 123, 15, 71, 36, 6, 149]`.
- Containing raw chunk `9a162313fe6cf02d97b6efd4`, span `[3444:5366]`; plan-query ranks `[42, 15, 37, 98, 32, 13, 25, 37, 60]`; objective-mode ranks `[58, 15, 37, 98, 32, 13, 25, 37, 60, 154]`.

## General fixes to test (not implemented here)

1. **Budget allocation before retrieval expansion.** Separate short per-action capability and limitation queries from scenario wording; avoid letting common objective, constraints, and product terms take repeated turns over the same semantic region. Maintain distinct action/reason coverage rather than assuming round-robin queries imply option coverage. Candidate 5's rank-4 chunk still misses, so rank improvements alone are insufficient.
2. **Structure-aware body retrieval.** Preserve exact offsets while marking navigation, main-body headings, and table row/column associations during source extraction. Down-weight repeated navigation and use heading/product context to rank body spans; never strip text without an offset map or rewrite quoted evidence. These recorded flattened sources cannot prove how much navigation caused each omission: this is a testable hypothesis, not a measured attribution.
3. **Better anchors, not more blind intro budget.** Page-intro anchors preserve broad summaries but miss deep limitations, pricing rows, supported-format lists, and tutorial definitions. Use bounded main-body section summaries/headings to identify promising original spans. Do not feed synthesized summary text as quoteable evidence. Do not simply reserve equal space for every URL: unrelated sources can consume the budget.
4. **Compact relation queries derived only from plans.** For example, product + capability/limitation, pricing + idle capacity, supported input formats, and entity-group split stability. This should reduce long-scenario vocabulary dilution. The pump/user mismatch motivates general grouping/generalization terminology, not copying the user quote.
5. **Bounded neighboring context only when needed.** All 10 targets already fit chunks, so larger overlap is not the first fix. Preserve table headers and local definitions with original spans when they materially clarify a hit, without unconditional neighborhood expansion that spends the 60k budget.
6. **Measure the real frontier.** Audit target chunk admission order, source diversity, navigation proportion, and marginal merged-span cost at a fixed 60k budget. Keep the full receipt checker and semantic verifier. Evaluate on held-out valid receipts after calibration; 180k recovery is not success at the requested budget.

## ACE-b2 receipt population and proof validity

Artifact: `cloud-engineer-v5-ace-b2-1018.json`, SHA256 `85d81dce77d6b4a1fe6f1575f11087d7ead99ca58bc07321c1ecfac5c50a1ab1`.

- **22 recorded decision proofs**: 13 with `passed: true` and four reasons each; nine with `passed: false` and zero reasons.
- Receipt denominator is therefore **52**, across 13 nonempty proof attempts. It is not 88, not the number of accepted candidates, and not coverage of nine vetoes.
- Re-running `check_evidence(reasons, attempt.sources)` passes **all 13 nonempty proofs**; zero mechanically invalid proposed receipts were observed. This checks exactly A–D, requested/final URL aliases, source SHA256/timestamp provenance and case-sensitive whitespace-normalized quote presence (300-char cap). It does **not** rejudge entailment or distractor correctness.
- PMLE control: 69 proofs = 15 passing/nonempty ×4 =60 receipts, plus54 failed/empty. All15 nonempty proofs pass the same mechanical check. The10 misses therefore cannot be dismissed as mechanically invalid receipts.
- ACE-b2 can supply a separate recall denominator but is still historical same-project evidence. Replaying it after tuning on its outcomes makes it calibration, not held-out validation. No ACE retrieval-recall percentage or model-quality result is claimed in this report.

## Assumptions and changes

Assumption: recorded candidate index plus attempt number identify the frozen source/plan pair. No retrieval constants or production/source code were changed. Only this report was created.
