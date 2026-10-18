---
title: "BigQuery ML vs AutoML vs custom training: PMLE rules"
description: "Choose BigQuery ML, Agent Platform AutoML or custom training by SQL workflow, supported tasks, model control and serving needs."
publishedAt: "2026-10-18"
updatedAt: "2026-10-18"
category: "Exam Preparation"
tags: ["PMLE", "Google Cloud", "Gemini Enterprise Agent Platform"]
author: "Testero Team"
citations: ["https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/start/training-methods", "https://docs.cloud.google.com/bigquery/docs/bqml-introduction", "https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-create-automl", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/automl-training-overview", "https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf"]
---

Use **BigQuery ML** when a supported model fits a SQL-centered workflow, **Agent Platform AutoML** when you want automated model building for a supported task, and **custom training** when you need control over model code, architecture, or the loss function. These choices overlap: BigQuery ML can train AutoML models, so data location alone does not decide the answer.

Last checked October 18, 2026.

Testero is independent and not affiliated with Google.

| Approach | Documented fit | Main boundary |
|---|---|---|
| BigQuery ML | Supported models through SQL | Model-specific objectives and limits |
| Agent Platform AutoML | Supported image and tabular tasks | Predefined objectives |
| Custom training | Your training application | You own model code and training logic |

Source: [current training comparison](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/start/training-methods).

## Start with the constraint

Google’s current documentation uses Gemini Enterprise Agent Platform, shortened here to Agent Platform. The June 2026 Professional Machine Learning Engineer guide connects this decision to objective 1.1 and to section 3. Objective 1.1 covers low-code model development with BigQuery ML and AutoML. Objectives 3.1–3.3 cover model and product trade-offs, training, and hardware.

## First separate the interface from the training method

The [BigQuery ML overview](https://docs.cloud.google.com/bigquery/docs/bqml-introduction) documents creating and using supported models through GoogleSQL or the Google Cloud console. Use it when analysts already prepare features in BigQuery and consume predictions through SQL.

The [BigQuery ML overview](https://docs.cloud.google.com/bigquery/docs/bqml-introduction) separates internally trained models, externally trained models, imported models, and remote models. Internal options include linear and logistic regression, k-means, matrix factorization, PCA, and time-series models. Other supported models train in Agent Platform. AutoML is one of those external options.

Choose the model and workflow together. Compare supported objectives, training cost, and operating effort rather than treating BigQuery ML and AutoML as mutually exclusive products.

## When SQL is a good starting point

Suppose the input is a table of customer activity and the output is a nightly risk score. The team already knows SQL. There is no requirement for a custom architecture or specialized loss function. Use BigQuery ML to establish a baseline and evaluate it against business needs.

SQL skills reduce the need for a separate Python training application. They do not remove the need to define labels, prevent leakage, choose an appropriate evaluation split, or compare useful metrics. BigQuery ML also supports hyperparameter tuning for supported models, so check those options before moving to custom training.

Check the chosen model’s constraints rather than treating BigQuery ML as one uniform algorithm. For example, the [AutoML SQL reference](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-create-automl) requires at least 1,000 input rows, permits up to 200 million rows, and requires input under 100 GB. Those limits belong to that interface, not to every BigQuery ML model.

## Where AutoML fits

AutoML automates model-building steps for supported tasks. The [current AutoML overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/automl-training-overview) lists image classification and object detection, plus tabular classification, regression, and forecasting. Use AutoML when its task and objective match the problem.

AutoML lets a team prototype a supported task without writing the training algorithm. The team still owns data preparation and evaluation. Automated tuning does not establish whether the resulting behavior is acceptable for a particular business use.

The entry point also changes what is available. The [BigQuery AutoML SQL reference](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-create-automl) exposes classifier and regressor model types. For AutoML forecasting, use the platform training workflow rather than the BigQuery AutoML CREATE MODEL interface. The reference also says these BigQuery ML AutoML models are not visible in the AutoML UI and are not available for AutoML batch or online predictions.

## Scenario 1: nightly repair-cost estimates

A regional equipment-maintenance company stores historical work orders in BigQuery. Its analysts want a nightly estimate of repair cost for upcoming jobs. They know SQL and have a numeric target.

Start by defining when the estimate must be available and which fields exist at that moment. A final invoice total cannot be an input to a prediction made before the repair. Build a held-out evaluation set that reflects the future workload, then establish a simple regression baseline in BigQuery ML.

Next, compare an AutoML regressor through BigQuery ML if the dataset meets its limits and a more automated modeling approach is worth the additional training cost. Evaluate errors across job categories, not only one overall metric. Keep nightly SQL scoring if it fits the operational workflow. Move to custom training only when measured shortcomings require control these models lack.

## When custom training earns its complexity

Use [custom training](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/start/training-methods) for a particular architecture, custom loss function, framework-specific implementation, or distributed training strategy. Agent Platform can run that application on managed infrastructure.

The current documentation distinguishes serverless training, reserved training clusters, and managed Ray. Serverless training provisions resources for a submitted job and releases them afterward. Reserved clusters address cases where assured dedicated capacity matters. Choose infrastructure for capacity and execution needs. You still own the training code and its tests.

Hardware selection follows the workload: verify memory requirements, supported accelerators, and distribution strategy rather than adding GPUs by habit.

## Scenario 2: a constrained defect detector

A factory collects labeled product images and needs to locate visible defects. Start with AutoML image object detection as a baseline.

The team evaluates detection quality on representative held-out images. Suppose a later requirement mandates a particular architecture and a custom training loss that weights certain costly failures differently. Use custom training to meet those requirements; image input alone does not require it.

The team must then own the model code, preprocessing, resource selection, reproducible training, and evaluation. It should compare the custom implementation with its baseline under the same business acceptance criteria. Keep the custom model only if it meets the requirements and justifies the extra engineering.

## Remote models are a different axis

As the [BigQuery ML overview](https://docs.cloud.google.com/bigquery/docs/bqml-introduction) explains, a BigQuery remote model references a deployed model endpoint. It allows SQL workflows to call that model; it does not retrain the endpoint merely by creating the reference. Imported models are different again: supported pretrained model artifacts can be brought into BigQuery for prediction.

Keep training, access, and serving separate. Ask what must be learned, where that learning runs, how users request predictions, and what each stage costs. Choose the smallest workflow that meets those requirements.


## Common traps and June 2026 objective mapping

Do not confuse a SQL interface with a training location, forecasting with regression, or remote endpoint access with training. The [June 2026 guide](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf) maps this reading to **1.1** (low-code development), **3.1** (product/model choices), **3.2** (training), and **3.3** (hardware).

Try the free PMLE diagnostic and select its [5-question quick check](/diagnostic), explore [PMLE sample questions](/pmle/sample-questions), or review the [Vertex AI / Agent Platform cheat sheet](/pmle/vertex-ai-agent-platform-cheat-sheet). Continue with the [study plan by domain](/blog/pmle-study-plan-by-domain) and [June 2026 exam changes](/blog/pmle-exam-changes-june-2026).


## Sources

- [Choose a training method](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/start/training-methods)
- [BigQuery ML overview](https://docs.cloud.google.com/bigquery/docs/bqml-introduction)
- [BigQuery AutoML SQL reference](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-create-automl)
- [AutoML training overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/automl-training-overview)
- [PMLE exam guide as of June 1, 2026](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf)
