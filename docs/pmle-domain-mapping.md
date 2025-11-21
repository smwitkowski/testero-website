# PMLE Domain Mapping: Legacy Topics → Canonical Blueprint Domains

**Purpose:** This document defines the mapping from legacy PMLE topic-based domain codes to the six canonical blueprint domains used for Week 2+ diagnostic selection.

**Last Updated:** January 2025

---

## Overview

During the initial migration, PMLE questions were assigned domain codes derived directly from their topic names (e.g., `"BigQuery ML for classification and regression"` → `BIGQUERY_ML_FOR_CLASSIFICATION_AND_REGRESSION`). 

For Week 2 domain-weighted selection, all PMLE questions must be mapped to one of six canonical blueprint domains that align with the official PMLE exam structure.

---

## Canonical Blueprint Domains

The six canonical domains (from `lib/constants/pmle-blueprint.ts`) are:

1. **ARCHITECTING_LOW_CODE_ML_SOLUTIONS** (12-13% weight)
   - Low-code ML solutions, AutoML, BigQuery ML

2. **COLLABORATING_TO_MANAGE_DATA_AND_MODELS** (14-16% weight)
   - Feature stores, metadata tracking, model versioning, collaboration tools

3. **SCALING_PROTOTYPES_INTO_ML_MODELS** (18% weight)
   - Custom training, distributed training, hyperparameter tuning, model development

4. **SERVING_AND_SCALING_MODELS** (19-20% weight)
   - Model serving, deployment, optimization, infrastructure scaling

5. **AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES** (21-22% weight)
   - Pipeline orchestration, CI/CD, automation, workflow management

6. **MONITORING_ML_SOLUTIONS** (13-14% weight)
   - Model monitoring, drift detection, explainability, responsible AI

---

## Legacy Domain → Blueprint Domain Mapping

| Legacy Domain Code | Legacy Domain Name | Blueprint Domain Code | Rationale |
|-------------------|-------------------|----------------------|-----------|
| `AUTOML_FOR_TABULAR_TEXT_AND_IMAGE_DATA` | AutoML for tabular, text, and image data | `ARCHITECTING_LOW_CODE_ML_SOLUTIONS` | AutoML is a low-code ML solution |
| `BIGQUERY_ML_FOR_CLASSIFICATION_AND_REGRESSION` | BigQuery ML for classification and regression | `ARCHITECTING_LOW_CODE_ML_SOLUTIONS` | BigQuery ML is a low-code ML solution |
| `ML_APIS_AND_MODEL_GARDEN_APPLICATIONS` | ML APIs and Model Garden applications | `ARCHITECTING_LOW_CODE_ML_SOLUTIONS` | Pre-built APIs and Model Garden are low-code solutions |
| `RETRIEVAL_AUGMENTED_GENERATION_RAG_WITH_VERTEX_AI_AGENT_BUILDER` | Retrieval Augmented Generation (RAG) with Vertex AI Agent Builder | `ARCHITECTING_LOW_CODE_ML_SOLUTIONS` | Agent Builder is a low-code solution |
| `VERTEX_AI_FEATURE_STORE_MANAGEMENT` | Vertex AI Feature Store management | `COLLABORATING_TO_MANAGE_DATA_AND_MODELS` | Feature stores are for managing data and models collaboratively |
| `ML_METADATA_TRACKING_AND_LINEAGE` | ML metadata tracking and lineage | `COLLABORATING_TO_MANAGE_DATA_AND_MODELS` | Metadata tracking supports collaboration |
| `MODEL_VERSIONING_AND_AB_TESTING` | Model versioning and A/B testing | `COLLABORATING_TO_MANAGE_DATA_AND_MODELS` | Versioning is part of model management |
| `VERTEX_AI_WORKBENCH_AND_JUPYTER_ENVIRONMENTS` | Vertex AI Workbench and Jupyter environments | `COLLABORATING_TO_MANAGE_DATA_AND_MODELS` | Workbench supports collaborative development |
| `CUSTOM_TRAINING_WITH_DIFFERENT_ML_FRAMEWORKS` | Custom training with different ML frameworks | `SCALING_PROTOTYPES_INTO_ML_MODELS` | Custom training is core to scaling prototypes |
| `DISTRIBUTED_TRAINING_WITH_TPUS_AND_GPUS` | Distributed training with TPUs and GPUs | `SCALING_PROTOTYPES_INTO_ML_MODELS` | Distributed training scales prototypes |
| `HYPERPARAMETER_TUNING_STRATEGIES` | Hyperparameter tuning strategies | `SCALING_PROTOTYPES_INTO_ML_MODELS` | Hyperparameter tuning is part of model development |
| `ML_EXPERIMENTS_TRACKING_WITH_VERTEX_AI_EXPERIMENTS` | ML experiments tracking with Vertex AI Experiments | `SCALING_PROTOTYPES_INTO_ML_MODELS` | Experiment tracking supports prototype iteration |
| `FINE_TUNING_FOUNDATIONAL_MODELS` | Fine-tuning foundational models | `SCALING_PROTOTYPES_INTO_ML_MODELS` | Fine-tuning is a form of model development |
| `ONLINE_AND_BATCH_PREDICTION_DEPLOYMENT` | Online and batch prediction deployment | `SERVING_AND_SCALING_MODELS` | Deployment is core to serving models |
| `SCALING_SERVING_INFRASTRUCTURE_AND_HARDWARE_SELECTION` | Scaling serving infrastructure and hardware selection | `SERVING_AND_SCALING_MODELS` | Infrastructure scaling is part of serving |
| `MODEL_OPTIMIZATION_FOR_PRODUCTION` | Model optimization for production | `SERVING_AND_SCALING_MODELS` | Optimization supports production serving |
| `VERTEX_AI_PIPELINES_AND_KUBEFLOW_ORCHESTRATION` | Vertex AI Pipelines and Kubeflow orchestration | `AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES` | Pipelines and orchestration are core to this domain |
| `DATA_PREPROCESSING_WITH_DATAFLOW_AND_TFX` | Data preprocessing with Dataflow and TFX | `AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES` | Preprocessing pipelines are part of orchestration |
| `AUTOMATED_MODEL_RETRAINING_STRATEGIES` | Automated model retraining strategies | `AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES` | Automated retraining is orchestration |
| `CICD_FOR_ML_WITH_CLOUD_BUILD` | CI/CD for ML with Cloud Build | `AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES` | CI/CD is automation and orchestration |
| `MODEL_MONITORING_AND_DRIFT_DETECTION` | Model monitoring and drift detection | `MONITORING_ML_SOLUTIONS` | Monitoring is core to this domain |
| `EXPLAINABLE_AI_AND_MODEL_INTERPRETABILITY` | Explainable AI and model interpretability | `MONITORING_ML_SOLUTIONS` | Explainability supports monitoring |
| `RESPONSIBLE_AI_AND_BIAS_DETECTION` | Responsible AI and bias detection | `MONITORING_ML_SOLUTIONS` | Bias detection is part of monitoring solutions |

---

## Mapping Rules

1. **One-to-one mapping**: Each legacy domain code maps to exactly one blueprint domain code.
2. **Content-based classification**: Mapping is based on the functional area and PMLE exam blueprint structure.
3. **Comprehensive coverage**: All legacy domains referenced by ACTIVE PMLE questions must be mapped.
4. **Idempotent updates**: The backfill script can be run multiple times safely (only updates questions that need changes).

---

## Usage

This mapping is used by the `scripts/backfill-pmle-domains.ts` script to update `questions.domain_id` values for all ACTIVE PMLE questions.

The script:
1. Fetches all ACTIVE PMLE questions with their current domain codes
2. Looks up each legacy domain code in this mapping table
3. Updates `questions.domain_id` to point to the target blueprint domain
4. Logs any questions that cannot be mapped (should not occur if mapping is complete)

---

## Future Maintenance

- If new legacy domains are discovered, add them to this mapping table
- If blueprint domains change, update both `lib/constants/pmle-blueprint.ts` and this mapping
- Review mapping accuracy periodically as PMLE exam blueprint evolves

