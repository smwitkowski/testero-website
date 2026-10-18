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

Testero is independent and not affiliated with Google. Recommendations and both hypothetical walkthroughs are original editorial reasoning, not recalled assessment content.

| Approach | Documented fit | Main boundary |
|---|---|---|
| BigQuery ML | Supported models through SQL | Model-specific objectives and limits |
| Agent Platform AutoML | Supported image and tabular tasks | Predefined objectives |
| Custom training | Your training application | You own model code and training logic |

Source: [current training comparison](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/start/training-methods).

## Start with the constraint

Google’s current documentation uses Gemini Enterprise Agent Platform, shortened here to Agent Platform. The June 2026 Professional Machine Learning Engineer guide connects this decision to objective 1.1 and to section 3. Objective 1.1 covers low-code model development with BigQuery ML and AutoML. Objectives 3.1–3.3 cover model and product trade-offs, training, and hardware. These are study mappings, not predictions about unseen assessments.

## First separate the interface from the training method

The [BigQuery ML overview](https://docs.cloud.google.com/bigquery/docs/bqml-introduction) documents creating and using supported models through GoogleSQL or the Google Cloud console. That makes it useful when analysts already prepare their features in BigQuery and consume predictions through SQL. It does not mean every model trains using only the BigQuery engine.

The [BigQuery ML overview](https://docs.cloud.google.com/bigquery/docs/bqml-introduction) separates internally trained models, externally trained models, imported models, and remote models. Internal options include linear and logistic regression, k-means, matrix factorization, PCA, and time-series models. Other supported models train in Agent Platform. AutoML is one of those external options.

This overlap matters. “BigQuery ML versus AutoML” can be a misleading question: a team can use AutoML through BigQuery ML. The more useful question is which supported model and workflow meet the requirement with acceptable cost and operating effort.

## When SQL is a good starting point

Suppose the input is a table of customer activity and the output is a nightly risk score. The team already knows SQL. There is no requirement for a custom architecture or specialized loss function. BigQuery ML is a sensible place to establish a baseline and evaluate it against business needs.

SQL skills reduce the need for a separate Python training application. They do not remove the need to define labels, prevent leakage, choose an appropriate evaluation split, or compare useful metrics. BigQuery ML also supports hyperparameter tuning for supported models, so describing it as having no model control would be wrong.

Check the chosen model’s constraints rather than treating BigQuery ML as one uniform algorithm. For example, the [AutoML SQL reference](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-create-automl) requires at least 1,000 input rows, permits up to 200 million rows, and requires input under 100 GB. Those limits belong to that interface, not to every BigQuery ML model.

## Where AutoML fits

AutoML automates model-building steps for supported tasks. The [current AutoML overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/automl-training-overview) lists image classification and object detection, plus tabular classification, regression, and forecasting. That is a bounded set of objectives, not a general-purpose replacement for any training program.

AutoML can help a team prototype a supported task without writing the training algorithm. The team still owns data preparation and evaluation. Automated tuning does not establish whether the resulting behavior is acceptable for a particular business use.

The entry point also changes what is available. The [BigQuery AutoML SQL reference](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-create-automl) exposes classifier and regressor model types. Do not assume that Agent Platform’s AutoML forecasting support means the same forecasting option exists in the BigQuery AutoML CREATE MODEL interface. The reference also says these BigQuery ML AutoML models are not visible in the AutoML UI and are not available for AutoML batch or online predictions.

## Original walkthrough: nightly repair-cost estimates

Imagine a regional equipment-maintenance company with historical work orders in BigQuery. Its analysts want a nightly estimate of repair cost for upcoming jobs. They know SQL and have a numeric target. This is an invented example, not an exam item.

Start by defining when the estimate must be available and which fields exist at that moment. A final invoice total cannot be an input to a prediction made before the repair. Build a held-out evaluation set that reflects the future workload, then establish a simple regression baseline in BigQuery ML.

Next, compare an AutoML regressor through BigQuery ML if the dataset meets its limits and a more automated modeling approach is worth the additional training cost. Evaluate errors across job categories, not only one overall metric. Keep nightly SQL scoring if it fits the operational workflow. There is no reason to introduce custom training unless measured shortcomings require control that these supported models lack.

## When custom training earns its complexity

The [training-method comparison](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/start/training-methods) supports custom training when the requirement is the training application itself: a particular architecture, custom loss function, framework-specific implementation, or distributed training strategy. Agent Platform can run that application on managed infrastructure.

The current documentation distinguishes serverless training, reserved training clusters, and managed Ray. Serverless training provisions resources for a submitted job and releases them afterward. Reserved clusters address cases where assured dedicated capacity matters. These choices concern infrastructure and execution; they do not eliminate the need to engineer and test the training code.

Hardware selection follows the workload: verify memory requirements, supported accelerators, and distribution strategy rather than adding GPUs by habit.

## Original walkthrough: a constrained defect detector

Imagine a factory collecting labeled product images. It first needs object locations for visible defects, making AutoML image object detection a plausible baseline. This second example is also hypothetical.

The team evaluates detection quality on representative held-out images. Suppose a later requirement mandates a particular architecture and a custom training loss that weights certain costly failures differently. That requirement—not simply the presence of images—creates a reason to investigate custom training.

The team must then own the model code, preprocessing, resource selection, reproducible training, and evaluation. It should compare the custom implementation with its baseline under the same business acceptance criteria. A preference for a familiar framework alone does not prove the extra engineering will pay off.

## Remote models are a different axis

As the [BigQuery ML overview](https://docs.cloud.google.com/bigquery/docs/bqml-introduction) explains, a BigQuery remote model references a deployed model endpoint. It allows SQL workflows to call that model; it does not retrain the endpoint merely by creating the reference. Imported models are different again: supported pretrained model artifacts can be brought into BigQuery for prediction.

Keep training, access, and serving separate. Ask what must be learned, where that learning runs, how users request predictions, and what each stage costs. The best choice is the smallest workflow that satisfies those requirements with evidence—not the product name that sounds most sophisticated.


## Common traps and June 2026 objective mapping

Do not confuse a SQL interface with a training location, forecasting with regression, or remote endpoint access with training. The [June 2026 guide](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf) maps this reading to **1.1** (low-code development), **3.1** (product/model choices), **3.2** (training), and **3.3** (hardware).

Try the free PMLE diagnostic and select its [5-question quick check](/diagnostic), explore [PMLE sample questions](/pmle/sample-questions), or review the [Vertex AI / Agent Platform cheat sheet](/pmle/vertex-ai-agent-platform-cheat-sheet). Continue with the [study plan by domain](/blog/pmle-study-plan-by-domain) and [June 2026 exam changes](/blog/pmle-exam-changes-june-2026).


## Sources

All sources last checked October 18, 2026.

- [Choose a training method](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/start/training-methods)
- [BigQuery ML overview](https://docs.cloud.google.com/bigquery/docs/bqml-introduction)
- [BigQuery AutoML SQL reference](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-create-automl)
- [AutoML training overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/automl-training-overview)
- [PMLE exam guide as of June 1, 2026](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf)
