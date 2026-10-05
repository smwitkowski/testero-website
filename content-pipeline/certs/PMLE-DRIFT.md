# PMLE drift: full official guide versus shipped code

Retrieved **2026-10-04**. Official guide linked from the current certification page:

- Page: <https://cloud.google.com/learn/certification/machine-learning-engineer>
- Full PDF: <https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf>
- PDF header: **Certification exam guide as of June 1, 2026**.
  This is an observed as-of date; an exam effective date is not stated (`null`).
- Cache: `content-pipeline/.cache/cert-registry/pmle-guide.txt`, extracted from the
  fetched official PDF; raw files and sample text are not committed.

This is a full six-section comparison, not a search-snippet comparison. PDF
zero-width spacing was converted to spaces for reading. No official sample
questions or options appear here. A guide removal below means **no longer
explicitly listed**, not product deprecation or proof that a topic cannot appear.

## Weights, identities and structure

| Section / preserved canonical domain code | Official June 2026 | Pipeline context | Live app | Official minus pipeline |
| --- | ---: | ---: | ---: | ---: |
| 1 `ARCHITECTING_LOW_CODE_ML_SOLUTIONS` | ~13% | 13% | 12.5% | 0 pp |
| 2 `COLLABORATING_TO_MANAGE_DATA_AND_MODELS` | ~16% | 14% | 15.5% | +2 pp |
| 3 `SCALING_PROTOTYPES_INTO_ML_MODELS` | ~21% | 18% | 18% | +3 pp |
| 4 `SERVING_AND_SCALING_MODELS` | ~20% | 20% | 19.5% | 0 pp |
| 5 `AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES` | ~18% | 22% | 21.5% | -4 pp |
| 6 `MONITORING_ML_SOLUTIONS` | ~13% | 13% | 13.5% | 0 pp |

The official approximate percentages sum to 101%; pipeline weights sum to 100%;
live app weights sum to 100.5%. A future weighted planner should record both the
raw published percentages and its normalized allocation policy (divide by the
sum for quotas), not silently alter the source guide. Approximate weights are not
an exact promise about any real exam form. Largest-remainder rounding applies to
the reviewed normalized quotas, not each subsection independently.

Pipeline evidence: `shared/domain_context.py:15,86,171,246,311,389`.
App evidence: `lib/constants/pmle-blueprint.ts:36-66`.
DB global-code/text-exam shape: `supabase/migrations/20261003000000_v2_baseline.sql:4-18`.
These are mappings for canonical content, not new exam variants or changed DB IDs.
No live DB code/row inventory was queried. The current schema migration does not
seed the six domains; their expected code strings are verified in source only.

Six top-level domains remain in the same order. Section titles remain substantively
aligned: low-code AI; collaboration/data/models; scaling prototypes; serving;
automation; monitoring AI. The legacy code strings use ML in sections 1 and 6,
while pipeline display names already use AI. Preserve those codes; don't rename
identities to match display copy.

The code contains **16 subsections and 66 consideration bullets**; the new full
guide contains **14 subsections and 52 bullets**. Counts are mechanical counts,
not weights or semantic coverage scores. The changes below span every subsection.

## Subsection/objective audit

References are to `content-pipeline/shared/domain_context.py`; bullet counts are
old code -> current guide. Descriptions below summarize scope changes, not sample
question wording.

| Guide locator / code lines | Bullets | Confirmed semantic delta |
| --- | ---: | --- |
| 1.1 (`:17-25`) | 3 -> 5 | Title now combines BigQuery ML and AutoML on Gemini Enterprise Agent Platform. Model-selection examples become classification/regression/forecasting/clustering; existing feature engineering and prediction remain. Adds Agent Platform AutoML training and Gemini fine-tuning using BigQuery. The old enumerated matrix-factorization/boosted-tree/autoencoder examples are not explicit here. |
| 1.2 (`:26-34`) | 3 -> 4 | Adds evaluation/selection from Agent Platform Model Garden, model/use-case tuning (Gemini/Imagen/Veo/models-as-a-service), and Gemini application cost/latency/availability optimization. Industry API examples now Document AI/Vision/Translate rather than Document AI/Retail. Explicit Vertex AI Agent Builder RAG objective is not listed. |
| Old 1.3 (`:35-45`) | 5 -> absent | Separate AutoML training subsection is removed. AutoML training appears in revised 1.1; do not claim every former data-preparation/forecasting/debugging consideration has an exact successor. |
| 2.1 (`:88-99`) | 6 -> 4 | Scope changes from organization-wide exploration to data for ML. Adds explicit preprocessing tool choice by scale/complexity (SQL, Spark, in-memory Python). Features/privacy remain with new branding. Standalone Vertex AI dataset management and inference document ingestion objectives are not listed; PHI is no longer a named example. |
| 2.2 (`:100-111`) | 6 -> 3 | Title now notebooks with Workbench/Colab examples, not just Jupyter. Collaboration/security and model prototyping remain. Named Dataproc backend selection, Spark kernels and source-repository integration are no longer separate bullets. Framework examples are PyTorch/sklearn/JAX rather than the old TensorFlow/Spark-inclusive list. |
| 2.3 (`:112-119`) | 2 -> 3 | Experiments/pipeline environment selection remains; evaluation now explicitly predictive and generative metrics plus LLM-as-a-judge. Adds artifacts/versions/lineage tracking formerly emphasized in 5.3; TensorBoard is no longer a named example. |
| 3.1 (`:173-180`) | 2 -> 4 | Title adds task-specific cost/complexity/latency/scalability constraints. Explicit model type (ARIMA/DNN/LLM), product and deployment-strategy choices replace a broad framework/architecture bullet. Interpretability remains. |
| 3.2 (`:181-193`) | 7 -> 6 | Data organization, training SDKs, troubleshooting and hyperparameter tuning remain. File-format list becomes structured/unstructured ingestion from sources. Foundation-model tuning now includes when tuning should be considered. Old standalone reliable-distributed-pipeline training bullet is not listed here. |
| 3.3 (`:194-201`) | 2 -> 2 | CPU/GPU/TPU choice remains; edge is no longer a named training-hardware example. Distributed training explicitly uses data/model parallelism, replacing Reduction Server/Horovod examples. |
| 4.1 (`:248-257`) | 4 -> 5 | Batch/online serving examples now Agent Platform/Model Garden/Cloud Run/GKE rather than Dataflow/BigQuery ML/Dataproc. Adds prebuilt/custom container packaging, versioned Model Registry, canary rollouts alongside A/B, and inference preprocessing/postprocessing. |
| 4.2 (`:258-268`) | 5 -> 5 | Feature serving, public/private endpoints, hardware, throughput scaling and optimization remain. Branding changes Vertex AI Prediction to Agent Platform Inference. Old detailed simplification/latency/memory/throughput examples are condensed, not a new independent objective list. |
| 5.1 (`:313-325`) | 7 -> 3 | Keeps validation, orchestration and training-serving consistency. Managed/unmanaged/template/custom pipelines now name Agent Platform Pipelines, Managed Service for Apache Airflow and Ray on Agent Platform. MLFlow hosting, Cloud Build/Run component triggers, hybrid/multicloud and TFX/Kubeflow DSL/Dataflow design are no longer separate considerations. |
| 5.2 (`:326-333`) | 2 -> 2 | Retraining policy remains; delivery pipeline scope now explicitly CI/CD/CT (continuous training). Cloud Build remains an example; Jenkins is no longer named. |
| Old 5.3 (`:334-342`) | 3 -> absent | Metadata subsection removed; artifact/version/lineage work now explicitly in 2.3. Old dataset-versioning hook wording is not an exact current bullet; migration needs a reviewed objective alias, not blind ordinal matching. |
| 6.1 (`:391-400`) | 4 -> 3 | Security now explicitly data exfiltration, malicious prompting and sensitive-data sharing with LLMs, plus Regex/safety filters/Model Armor. Responsible AI and explainability remain. Standalone fairness/readiness assessment is no longer a separate bullet. |
| 6.2 (`:401-411`) | 5 -> 3 | Production continuous monitoring remains. Common issues now combine training-serving skew, data drift, concept drift and attribution drift; adds monitoring/testing/evaluating gen-AI solutions. Explicit baseline/simpler-model/time-dimension and training/serving-error bullets are not separately listed. |

The introduction also adds prompt/context engineering and data-governance
familiarity. Branding across the guide changes Vertex AI to **Gemini Enterprise
Agent Platform**. Do not perform an unreviewed string replacement in technical
corpus text: historical names, URLs and service capabilities need verified aliases.

## Implications, not automatic changes

1. Review PMLE registry differences before any new content generation. Give new or
   moved objectives persistent identities/aliases separate from positional guide
   locators (`1.1:1`, etc.); ordinal IDs alone are not stable across revisions.
2. Reallocate future batches toward sections 2/3 and away from 5 under a recorded
   normalization policy. Current equal-count all-domain generation does not use
   these weights (`scripts/generate_all_domains.py:216-255`).
3. Flag existing content affected by objective moves, deleted examples, scope
   additions and branding changes. Exact affected question IDs are **unknown**:
   no DB/content inventory was read, and current `ProgramOutput` lacks domain
   coverage metadata (`shared/batch_eval.py:121-130`).
4. Re-ground technically changed items from current official service docs; a
   guide bullet is scope evidence, not capability proof. Preserve founder review
   and fail-closed independent-family judging before later publication.
5. Do not patch the live app blueprint in Phase 1. Its PMLE-only selector and
   single-answer scoring boundaries remain unchanged.
