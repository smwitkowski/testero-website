# Frozen PMLE planner cards

## Result

- Four cards. Lengths: [245, 203, 392, 294]. Median: 269.5 characters. Cap: 1,200.
- Canonical frozen JSON: `content-pipeline/.cache/optimize/cards/pmle-planner-cards-v1.json` (tracked explicitly; no duplicate output copy).
- Full selected associations, source veto reasons and input hashes: `cards.audit.json`.
- Focused tests: **29 passed** (`card-tests.txt`). Parent runs the full gate.
- Every produced objective had at least three distinct vetoed candidates. Every retained coverage claim has at least two distinct candidate IDs. A lifecycle-only card is permitted when no safe recurring coverage claim remains.
- Six objectives passed the initial conservative extraction. Four produced cards. One invocation failed because `env -i` stripped subscription authentication. One first invocation was interrupted during launch correction. Neither was retried. See `calls.json`.

## Deterministic safety revision

- No additional model calls. Original response files and original selections are preserved. See `card-safety-revision.json` for old/new text hashes and removed IDs.
- 1.2:3: removed entity-only RAG Engine anchor; an entity is not a concrete recurring unsupported claim. Kept the already-selected dated Imagen lifecycle fact and names. Coverage explicitly states that no reliable recurring coverage claim was retained.
- 3.3:2: removed the entity-only TensorFlow TPU strategy anchor. Contextualized the shared TPUStrategy compound replication-plus-batch/gradient claim using both source reasons. The text explicitly distinguishes single-slice TensorFlow from Multislice restrictions.
- The generic builder now rejects entity-only anchors, requires source context for this compound TPU claim, and allows zero selected claims only if a dated lifecycle fact is selected. Saved selections can be re-rendered safely without inference.

## Freeze and exclusions

- Cutoff: `2026-10-26T00:00:00Z`, exclusive.
- Historical candidate artifacts have no creation time. Frozen artifact mtime is a conservative latest-possible creation bound. Explicit timestamps, when present, are checked too. Files modified on/after cutoff are excluded, not backdated from filenames or page fetch times.
- Exclude artifact filenames/tags `night-*`, `dsab-*`, `doccheck-ab-*`, and any `ab_assignment` at artifact/candidate/scope level.
- Whole canary/gold objectives are held out when discovered from monitor filename/marker/metadata or explicit `--cohort` inputs. No held-out objectives were discovered in the two authorized generation roots. Explicit cohort paths were not supplied. The frozen dataset manifest also listed no excluded training objectives. No sources outside the named roots were searched for monitors. Random test split objectives are not treated as canary/gold.
- Only `decision_attempts[].proof.reason` for an explicitly false doc-check boolean is mined. Council prose, accepted-question text and plans are not lesson inputs.
- Exact predicate-bearing claims must repeat inside explicit absence clauses. Bare common products/objects do not establish recurrence. Candidate-ID/reason-hash/span bindings and source scope are validated before Claude and after selection.
- Claude sees prevalidated fact IDs/text, not raw proof reasons, judge identities, rubric fields or council prose. One tool-disabled CLI invocation per objective selects a compact card. Deterministic rendering cannot invent a model-selected claim.
- Lifecycle facts use pre-cutoff corpus snapshots and dated product-specific notices. Page IDs bind URL and page body hash. URLs, exact spans and retrieval dates remain in the audit, not the card.
- Text SHA256 is computed over UTF-8. The builder is offline and opt-in. Normal generation does not import it.

## Known limitations

- Conservative recurrence yields sparse coverage. Do not claim broad objective coverage or measured live improvement.
- 5.1:3 has a real Feature Store lifecycle fact from its corpus, but it may be incidental to preprocessing consistency. No current product names were extracted for that objective. Review before promotion.

## Full cards and provenance

### `machine-learning-engineer:standard:1.2:3`

Veto candidates: 6. Characters: 245. Text SHA256: `dd11f4b5bc432d54983e970805d0f554bb7e35c20257e0fc0a8f7ac7559855cc`.

```text
Coverage: No reliable recurring coverage claim retained.
Lifecycle: imagen-3.0-capability-001 is listed as discontinued; migration deadline 2026-06-30. As of 2026-10-14 (page-923d9e307349f370).
Current names: Imagen; Agent Platform; Model Garden
```

Source candidate IDs: `006dfe3c-807c-57f1-9c02-6d068b0c3126`, `284c228e-614e-547e-bc84-f5166cdb5c64`, `8fbcd898-40b4-5399-8e93-72244afb91cc`, `b9703f60-b8d6-50e4-a12a-3e830fd70832`, `c8fefd99-17e6-5a98-b896-affa7c043705`, `dde4b21f-ec37-5eea-b75d-cfd1f30891b3`.

Source page IDs: `page-923d9e307349f370`.

Lifecycle source `page-923d9e307349f370`: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/4-0-generate

Retrieved: `2026-10-14T14:58:46.167799+00:00`; body SHA256: `3f2f11c7d7476adcd0071e133856da4a1a559ca0d8e17e68dbd5a2d01c8f6e55`.

Vertex AI documentation is no longer being updated Vertex AI's services are now part of Gemini Enterprise Agent Platform. See the most up-to-date information in the Agent Platform documentation. Home Documentation AI and ML Vertex AI Generative AI on Vertex AI Guides Send feedback Imagen 4 Stay organized with collections Save and categorize content based on your preferences. Imagen 4 is our latest line of image generation models. This page documents the capabilities and features of the Imagen 4 models. Caution: The following table describes image generation endpoints that are deprecated and their replacements. We recommend updating your model endpoints before June 30, 2026, to avoid service disruption. Discontinued endpoints Recommended endpoint migration imagegeneration@002 gemini-2.5-flash-image imagegeneration@003 gemini-2.5-flash-image imagegeneration@004 gemini-2.5-flash-image imagegeneration@005 gemini-2.5-flash-image imagegeneration@006 gemini-2.5-flash-image imagetext@001 gemini-2.5-flash-image imagen-3.0-capability-001

### `machine-learning-engineer:standard:3.2:6`

Veto candidates: 7. Characters: 203. Text SHA256: `1473cd92cc939855f7167f4fc3df144bf4c016c8ec0f706bfe2e4921f1d7f835`.

```text
Coverage: The docs here do not establish Model Garden full fine-tuning capability.
Lifecycle: No dated lifecycle fact selected.
Current names: Agent Platform; Agent Platform custom training; Model Garden
```

Source candidate IDs: `0ee006ac-b8f2-5ce1-8b6c-8c0c27756cc8`, `4969eb77-b677-5369-83b0-83ad14e46fae`, `5729d1c6-84ef-5fbc-a45e-84ef434cca49`, `5bac4a13-0fe0-503f-8037-787a430aa2b7`, `641e51b9-b4a8-57b0-a3cc-6eef736f083a`, `798803a1-9ffd-500e-9f0b-30f83267e238`, `90f90ed6-e94f-5f20-bf11-b094d24c0223`.

Source page IDs: none.

Coverage association `claim-857006816e06`:

- Candidate `5729d1c6-84ef-5fbc-a45e-84ef434cca49`, reason SHA256 `925cb4a5faeb2796ea2c051acd7482f9ff1f9301b8db854990af89f6f19f80fd`: doesn't verify A's specific RAG Engine corpus refresh behavior for changed Cloud Storage documents or D's Model Garden full fine-tuning capability
- Candidate `5bac4a13-0fe0-503f-8037-787a430aa2b7`, reason SHA256 `d47c463985610380d95238616fb7ebed34f806ab2fbc1975ddbcc20bea20ca85`: does not establish Model Garden full fine-tuning capability or its training-code and compute-maintenance responsibilities

### `machine-learning-engineer:standard:3.3:2`

Veto candidates: 7. Characters: 392. Text SHA256: `5199ca83e798b7c8929a2bf0d3b5c0603c8666f72deb7e4eab545dcfdc6bde98`.

```text
Coverage: For proposed TensorFlow single-slice TPU training, the supplied scaling/Multislice pages did not establish the TPUStrategy synchronous-replication claims together with the proposed batch-splitting or gradient-aggregation behavior. Multislice's TensorFlow restriction does not rule out single-slice training.
Lifecycle: No dated lifecycle fact selected.
Current names: Agent Platform
```

Source candidate IDs: `21fbca94-88ba-5819-a24f-9dfe8a5ab954`, `400b245e-65c5-595b-a4da-a71771b0a9c2`, `6e20b7c1-43e2-512d-9be3-33c04be99ba9`, `8ea2bc0b-68ae-5437-8448-bd1afcf07f82`, `ad407b93-8cda-5d31-b8a1-da3fc6e14568`, `ae4879cb-8d4e-50ec-b142-7a8985d4c338`, `cf2853e9-2d30-5cab-a3c1-5316ed72db2a`.

Source page IDs: none.

Coverage association `claim-f6246397b54b`:

- Candidate `21fbca94-88ba-5819-a24f-9dfe8a5ab954`, reason SHA256 `e3c0384f3cbb665b9c2c6e3de13c5b4c04d4a18a3f4d3befdf272db89cc46b0c`: does not verify TPUStrategy's synchronous replication and batch splitting, MultiWorkerMirroredStrategy's GPU synchronization, or ParameterServerStrategy's asynchronous updates
- Candidate `ae4879cb-8d4e-50ec-b142-7a8985d4c338`, reason SHA256 `d14e2cc239622079e0f4cb8897b54f731d8f2f9d21d476462d3b65319ab56986`: does not establish TPUStrategy's synchronous replication and gradient aggregation on the existing TPU slice, or MirroredStrategy's GPU capabilities

### `machine-learning-engineer:standard:5.1:3`

Veto candidates: 16. Characters: 294. Text SHA256: `9a230913df2ac09e1def707d82b354bc8320bd05222819b50758e46cdf182aa6`.

```text
Coverage: The docs here do not establish training-only augmentation behavior.
Lifecycle: Feature Store Optimized online serving is deprecated; critical patches only from 2026-05-17; sunset 2027-02-17. As of 2026-10-25 (page-658e16541d9b7027).
Current names: No objective-specific name selected.
```

Source candidate IDs: `117b5893-71e0-5bd4-8e77-9f76b567d290`, `13bc06e9-7700-5473-98d0-c7d2e4c5c932`, `218cb21a-4166-52e4-a5b5-d08ff8b62af4`, `2cd24636-8488-5a41-8d48-d0098bf90046`, `3337a1ec-140f-5412-b3c1-10e879c5a676`, `3c2d23e0-11ba-5e83-b40c-3d963fdd67d8`, `45251fab-f7dd-590d-ae0f-fd24d1cb6d07`, `780329f8-bfb3-537d-a943-d7e4bbbc9f23`, `8df094e1-1166-5d4b-80f1-6cfca6b28016`, `9a4bed18-cabc-5123-a8a1-933b116b5195`, `a018a3f6-7f29-5aa8-b79b-7499e515470f`, `a420a187-26a9-512e-a6cb-a38d635c53a9`, `b825ca3d-acb2-5ca2-9848-4dee5be19088`, `b88a3ed9-393e-5d9e-a6b0-b58e5c26f06f`, `c78a6c3e-ba92-52c2-be1f-3ebb8379a0ae`, `faf8f473-f8df-5306-b3bb-ea15359d818d`.

Source page IDs: `page-658e16541d9b7027`.

Coverage association `claim-a8a1096cf721`:

- Candidate `9a4bed18-cabc-5123-a8a1-933b116b5195`, reason SHA256 `6812312f960f46a15aaeba7d5bb14890eb4e473b73ab9cf2b1a574fd8d619899`: do not establish the decisive resizing, rescaling, or training-only augmentation behavior
- Candidate `b825ca3d-acb2-5ca2-9848-4dee5be19088`, reason SHA256 `7077cde6838a1acaa7dcc49b1f467bf8e1deefb0ab509868dde40fdc0e4bc225`: does not establish training-only augmentation behavior or the augmentation-specific claims behind A and C

Lifecycle source `page-658e16541d9b7027`: https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/featurestore/latest/serve-feature-values

Retrieved: `2026-10-25T16:42:25.754689+00:00`; body SHA256: `c415804764d013b0351629227bedb2973f9e8ed7ef283603c2b9ca8068d0813f`.

Fetch feature values using Optimized online serving from a public endpoint Gemini Enterprise Agent Platform Feature Store Optimized online serving is deprecated. Beginning on May 17, 2026, no new features will be added and only critical patches will be provided. On February 17, 2027, the capability will be fully sunset and APIs will no longer be available.
