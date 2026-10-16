---
title: "PMLE exam changes: June 2026 guide explained"
description: "See the June 2026 PMLE domains, Agent Platform naming and scope changes, with official sources and clear limits on historical comparisons."
publishedAt: "2026-10-16"
updatedAt: "2026-10-16"
category: "certification-guides"
tags: ["Google Cloud", "Certification"]
author: "Testero Team"
citations: ["https://cloud.google.com/learn/certification/machine-learning-engineer", "https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf", "https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english.pdf"]
---

The PMLE exam guide marked **June 1, 2026** uses Gemini Enterprise Agent Platform names and covers six ML engineering domains, including generative AI and production decisions. Start with the current guide, not an old practice set's service list.

Last checked October 16, 2026.

## What does the June 2026 date actually mean?

The official PDF says “Certification exam guide as of June 1, 2026.” That is a guide date, not a separately stated exam cutover date. Google's certification page says the exam was updated for the transition from Vertex AI to Gemini Enterprise Agent Platform, data and analytics changes, and an emphasis on Google Cloud native solutions.

There is a limit to historical comparisons. When we checked, both the older, unversioned PDF URL and the current “english_new” URL served the current section structure and weights. An older-looking URL does not preserve an older blueprint. We cannot use today's downloads to independently establish previous weights or the exact objective-by-objective delta. The table below therefore gives current weights only, not an invented before-and-after percentage change.

For a maintained overview of logistics and official links, use the [PMLE certification page](/certifications/machine-learning-engineer).

## The six sections and current weights

| Section | Approximate exam weight |
| --- | ---: |
| Architecting low-code AI solutions | 13% |
| Collaborating within and across teams to manage data and models | 16% |
| Scaling prototypes into ML models | 21% |
| Serving and scaling models | 20% |
| Automating and orchestrating ML pipelines | 18% |
| Monitoring AI solutions | 13% |

These are Google's approximate weights. They total 101%, so do not convert each percentage into an exact promised question count. The guide does not provide a separate weight for every technology or consideration bullet. Treat a domain as a collection of decisions, not a prediction of how many questions will mention a product.

The [domain-by-domain explanation](/blog/pmle-exam-domains-weights) turns those headings into practical preparation tasks.

## What should you update in your study notes?

### Low-code puts the choices together

The current guide places BigQuery ML and Agent Platform AutoML together in section 1.1. It includes AutoML training and fine-tuning Gemini using BigQuery. Section 1.2 includes Model Garden selection, model tuning for a use case, and cost, latency and availability for Gemini applications.

The study implication is not “learn every model.” Given a document-processing task, ask what capability the application needs, what data is available and whether customization is necessary. Given structured prediction data, compare an appropriate low-code approach with the burden of a custom model. Those are illustrative preparation exercises, not reports of live exam questions.

### Collaboration includes evaluation and lineage

Section 2 asks you to choose preprocessing tools by data scale and complexity. It names SQL in BigQuery, Dataflow, Apache Spark and in-memory Python frameworks as examples. Notebook work includes collaboration and security, not just running a training cell.

The current experiment section explicitly covers predictive and generative evaluation, including LLM-as-a-judge, plus artifacts, versions and lineage. Artifact and lineage work is explicit in section 2.3. If your notes place it elsewhere, map the topic to the current objective instead of dropping it.

A useful exercise is to explain how you would reproduce a promising experiment after the original notebook author leaves. Write down which data, model version and evaluation evidence another engineer would need.

### Scaling is about a defensible model and training choice

Section 3.1 explicitly brings together cost, complexity, latency and scalability. Its examples span ARIMA, deep neural networks and large language models. Other bullets cover product choice, deployment strategy and interpretability.

Section 3 also retains training, troubleshooting, hyperparameter tuning and hardware selection. Data and model parallelism are named distributed-training strategies. For preparation, separate the question “Is this the right model for the task?” from “How should this training job use more resources?” More compute is not an answer to the wrong modeling assumption.

### Serving goes beyond creating an endpoint

Section 4.1 names batch and online inference, prebuilt and custom containers, Model Registry, A/B testing, canary deployments, and inference preprocessing and postprocessing. These are useful checkpoints for an older study plan that stops once a model is deployed.

Try tracing a prediction request through its input transformation, model version, output transformation and consumer. Then consider how you would compare a replacement version without assuming that every rollout strategy answers the same question. Section 4.2 adds feature serving, endpoint exposure, hardware and throughput scaling.

### Pipeline coverage still requires end-to-end reasoning

The current automation section has two subsections: end-to-end pipelines and retraining. It names Agent Platform Pipelines, Managed Service for Apache Airflow and Ray on Gemini Enterprise Agent Platform as orchestration examples. Validation and consistent preprocessing across training and serving remain explicit.

CI/CD/CT is spelled out as continuous integration, continuous delivery and continuous training. Prepare to explain what triggers a workflow and what evidence permits a model to advance. A retraining schedule alone is not a validation policy.

### Monitoring explicitly includes generative AI risk

Section 6 names data exfiltration, malicious prompting and sensitive information shared with LLMs. Its security examples include regular expressions, safety filters and Model Armor. Responsible AI and explainability remain in scope.

The monitoring considerations name training-serving skew, data drift, concept drift and feature attribution drift, alongside monitoring, testing and evaluating generative solutions. An exercise that only checks whether an endpoint returns HTTP success misses the decisions this section describes.

## Vertex AI to Agent Platform: update labels carefully

The guide uses the full name **Gemini Enterprise Agent Platform**, often shortened to **Agent Platform**. That naming change does not mean PMLE has become solely an agent-building exam. The current outline still covers data preparation, conventional modeling, training, serving, pipelines and monitoring.

Use the [verified product-name mapping](/blog/vertex-ai-agent-platform-name-mapping) when reading older tutorials. Do not replace strings in code or assume a renamed product has identical limits, configuration or availability. An exam guide defines scope; product documentation establishes capabilities.

## What still belongs in your preparation?

The current guide calls for conventional ML knowledge as well as foundation-model work. These remain part of the scope despite the new platform branding. The certification page still describes building, evaluating, productionizing and optimizing AI solutions, with collaboration and responsible AI as part of the role.

Google also says the exam does not directly assess coding skill. That is not permission to ignore Python or SQL: the page says minimum proficiency should let you interpret questions containing snippets. Prepare to reason about the workflow rather than memorizing an SDK call list.

“Not named in the current guide” and “cannot appear” are different statements. An omitted example does not prove that the underlying engineering concept is irrelevant or that a service has been deprecated. Match older notes to current objectives before discarding them.

## Turn the changes into a preparation backlog

Keep the material that still teaches a current decision. Add focused work on the areas you cannot explain: model selection under constraints, generative evaluation, inference packaging, training-serving consistency and AI security. Record an open question beside each unfamiliar objective instead of treating a service-name checklist as understanding.

Start with the [free PMLE diagnostic](/diagnostic), then compare the domain breakdown with the current guide. It is a way to choose your next study task, not a prediction of Google's pass/fail result.

## Sources

- [Official PMLE certification page](https://cloud.google.com/learn/certification/machine-learning-engineer)
- [Exam guide as of June 1, 2026](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf)
- [Unversioned guide URL, also checked](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english.pdf)

Testero is independent and not affiliated with Google.
