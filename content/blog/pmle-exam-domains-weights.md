---
title: "PMLE exam domains and weights explained (2026)"
description: "Understand all six PMLE domains, their approximate weights and the engineering decisions to practice for each part of the current guide."
publishedAt: "2026-10-16"
updatedAt: "2026-10-16"
category: "certification-guides"
tags: ["Google Cloud", "Certification"]
author: "Testero Team"
citations: ["https://cloud.google.com/learn/certification/machine-learning-engineer", "https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf"]
---

The PMLE exam has six domains. Use their approximate weights to keep your preparation balanced, then study the decisions inside each one: choosing an approach, preparing data, training, serving, automating and monitoring. A list of product names is not enough to connect those decisions.

Last checked October 16, 2026.

This explanation follows Google's exam guide **as of June 1, 2026**. Examples below are original study scenarios, not recalled exam questions or predictions about a particular exam form.

## PMLE domains and weights at a glance

| Domain | Approximate weight | Central preparation question |
| --- | ---: | --- |
| Architecting low-code AI solutions | 13% | How much custom ML does this problem need? |
| Collaborating within and across teams to manage data and models | 16% | Can the team safely reproduce and compare its work? |
| Scaling prototypes into ML models | 21% | Which model and training approach fit the constraints? |
| Serving and scaling models | 20% | How will usable predictions reach the application? |
| Automating and orchestrating ML pipelines | 18% | What makes the workflow repeatable and safe to update? |
| Monitoring AI solutions | 13% | How will the team detect and respond to failure or risk? |

Google labels the percentages approximate; they add to 101%. They are not an exact question allocation or separate weights for individual services. Keep the published numbers rather than silently changing a domain to make the total round.

The [PMLE certification page](/certifications/machine-learning-engineer) collects exam facts and official guide links. If your resources use an older outline, read the [June 2026 changes](/blog/pmle-exam-changes-june-2026) before organizing them by domain.

## 1. Architecting low-code AI solutions: approximately 13%

This domain asks where to start before building a bespoke training system. The guide puts BigQuery ML and Agent Platform AutoML together, and also covers Google Cloud AI APIs and foundation models. Its examples include classification, regression, forecasting and clustering, plus Model Garden selection and Gemini application cost, latency and availability.

### Decisions to practice

Consider a retailer that wants next-period demand estimates from structured historical records. Compare that task with a team extracting fields from documents. Ask what output each team needs, what data it already has and whether the work is primarily prediction, extraction or generation. Do not select a foundation model merely because the application uses the word “AI.”

Then change a constraint: the team now has labeled examples, or its response-time budget becomes tighter. Explain whether the change affects the model family, the customization approach or the serving design. The guide explicitly includes Gemini fine-tuning using BigQuery and tuning models for a use case; study when customization is justified, not only where its menu appears.

A useful study artifact is a short decision note: chosen approach, rejected alternative, required data and the requirement that decided the choice.

## 2. Collaborating within and across teams: approximately 16%

The full domain name includes managing data and models. Its scope is broader than teamwork etiquette: preprocessing tool choice, feature organization, privacy, notebook environments, evaluation and experiment lineage are all named considerations.

### Decisions to practice

Imagine an analyst's prototype works on a local sample, but the production dataset is larger and contains sensitive fields. Compare preprocessing approaches by scale and complexity. The guide names BigQuery SQL, Dataflow, Apache Spark and in-memory Python frameworks as examples. Explain what you would need to know before selecting one, rather than declaring a tool universally best.

Next, consider two experiments with different results. What changed: the data, features, model, prompt or evaluation method? Prepare to describe the artifacts and versions needed for a meaningful comparison. Section 2.3 explicitly combines predictive and generative evaluation, including LLM-as-a-judge, with tracking versions and lineage.

Your output from this domain should make it possible for another engineer to understand a result without relying on the original author's memory. Include access and privacy decisions, not only a notebook link.

## 3. Scaling prototypes into ML models: approximately 21%

This is the largest published domain weight. It covers model choice under constraints, training and hardware. The guide explicitly names cost, complexity, latency, scalability and interpretability. It also includes training-data organization, failure troubleshooting, hyperparameter tuning and decisions about tuning foundation models.

### Decisions to practice

Take a prototype that predicts equipment failures. An operations team needs timely results and an explanation it can act on. List the candidate model approaches, the available data and the interpretation requirement before discussing accelerators. A model that looks attractive on a single metric might not fit the application constraints.

For a training problem, separate modeling questions from execution questions. Is the experiment testing the right hypothesis? Is the input pipeline sound? Is the job limited by its resource choice? The guide names CPUs, GPUs and TPUs, along with data and model parallelism for distributed training. Learn to explain which constraint you are investigating before proposing a bigger job.

A practical completion check is a training plan with a comparison metric, a failure investigation path and a reason for the chosen compute approach. Do not treat “distributed” as a synonym for “better.”

## 4. Serving and scaling models: approximately 20%

This domain starts where an offline model must become useful to another system. The guide includes batch and online inference; model packaging with prebuilt or custom containers; model versioning; rollout strategies; and preprocessing and postprocessing at inference time.

### Decisions to practice

Compare a nightly scoring job with an interactive risk check. Ask when the consumer needs a result, how many requests arrive and what happens when a prediction is unavailable. Those requirements should drive a serving choice rather than a preference for an endpoint.

Now introduce a replacement model. Define what you want to learn from its rollout, which version handles each request and what evidence would cause you to stop. The guide names A/B testing and canary deployments. Study the purpose of a comparison and its operational controls, not a memorized traffic percentage.

Section 4.2 adds feature serving, public and private endpoints, hardware selection and throughput-based scaling. Trace the whole prediction path so that input transformation, access boundaries and output handling do not disappear between the training and application teams.

## 5. Automating and orchestrating ML pipelines: approximately 18%

Automation here is not simply running a notebook on a timer. The guide includes data and model validation, orchestration choices, consistent preprocessing between training and serving, retraining policy, and CI/CD/CT. CT means continuous training.

### Decisions to practice

Suppose fresh data arrives regularly, but its quality varies. Describe the conditions that start training, the checks that can stop the workflow and the evidence required before a new model reaches consumers. Keep a training trigger separate from a deployment approval.

Compare a pipeline assembled from templates with a custom workflow. The guide's orchestration examples include Agent Platform Pipelines, Managed Service for Apache Airflow and Ray on Gemini Enterprise Agent Platform. Ask what the workflow must coordinate and who will operate it before choosing a platform.

Write a failure path as carefully as the success path. If validation rejects an input or candidate model, what remains in service and what evidence should the team inspect? This is a preparation exercise for the domain's repeatability and validation decisions, not a promise that the exam uses a particular workflow layout.

## 6. Monitoring AI solutions: approximately 13%

Monitoring covers behavior and risk, not only infrastructure availability. The guide names explainability, responsible AI, model monitoring and generative AI evaluation. Security examples include data exfiltration, malicious prompting and sensitive data shared with LLMs, with tools such as safety filters and Model Armor.

### Decisions to practice

A prediction service can stay reachable while its useful performance changes. Practice distinguishing training-serving skew, data drift, concept drift and feature attribution drift, all named in the guide. For each, ask what observation would support the diagnosis and what you would investigate next.

For a generative application, add a malicious user request and a document containing sensitive information to your review checklist. Identify the risk you are trying to control, the evaluation evidence you need and where a protective measure belongs. Do not use a successful HTTP response as your only quality signal.

A good artifact is a monitoring and response note: signal, reference data, owner, investigation and possible intervention. Avoid deciding in advance that every alert means retraining.

## Use weights without letting them hide your gaps

A high-weight domain deserves deliberate coverage, but a smaller domain you cannot explain still needs work. Use the [domain-based study plan](/blog/pmle-study-plan-by-domain) to turn weaknesses into exercises. Keep checking product behavior in official documentation rather than treating a guide bullet as a complete service specification.

Start the [free PMLE diagnostic](/diagnostic) to get a study signal, then compare its domain breakdown with what you can explain and demonstrate. Neither an internal readiness label nor a practice score predicts Google's exam result.

## Sources

- [Official PMLE exam guide](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf)
- [Official PMLE certification page](https://cloud.google.com/learn/certification/machine-learning-engineer)

Testero is independent and not affiliated with Google.
