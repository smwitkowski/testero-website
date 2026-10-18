---
title: "Canary vs shadow deployment on Agent Platform: PMLE rules"
description: "Compare canary and shadow deployment on Agent Platform: traffic splits, user impact, endpoint limits and PMLE rollout decisions."
publishedAt: "2026-10-18"
updatedAt: "2026-10-18"
category: "Exam Preparation"
tags: ["PMLE", "Google Cloud", "Gemini Enterprise Agent Platform"]
author: "Testero Team"
citations: ["https://docs.cloud.google.com/service-mesh/docs/service-routing/advanced-traffic-management", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/general/deployment", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints/deployModel", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/choose-endpoint-type", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/rolling-deployment", "https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf"]
---

Choose **canary** when the candidate should answer a small share of live requests; choose **shadow evaluation** when copied inputs should reach the candidate but its answers must not control user-facing decisions. Agent Platform documents native traffic splitting for progressive rollout, not automatic request mirroring. “Zero downtime” alone does not decide between them.

Last checked October 18, 2026.

Testero is independent and not affiliated with Google. The two walkthroughs are original study examples, not recalled assessment content.

Here, Agent Platform means Gemini Enterprise Agent Platform's model inference services, not an agent execution runtime. For the current product names, see the [Vertex AI name-mapping guide](/blog/vertex-ai-agent-platform-name-mapping).

## Start with who answers the user

A canary model serves a small share of real requests. Its output can affect users, so a canary tests both model behavior and the consequences of using that behavior. You increase its share only after collecting enough evidence.

In a shadow design, the candidate receives copied inputs while the application continues returning the incumbent response. Google's [Cloud Service Mesh traffic-mirroring documentation](https://docs.cloud.google.com/service-mesh/docs/service-routing/advanced-traffic-management) describes the underlying pattern: send an identical request to a mirror backend without waiting for its response. That is conceptual evidence, **not** an Agent Platform Endpoint feature or a claim that these services integrate automatically. The candidate must actually receive copied inputs; a deployment with no traffic is not a shadow test.

| Question | Canary | Shadow evaluation |
|---|---|---|
| Does the candidate answer users? | Yes, for its assigned traffic | No, if the application isolates its output |
| Are requests duplicated? | Not by traffic splitting itself | Yes, for the sampled inputs being compared |
| What does it reveal? | Real serving and user-impact evidence | Candidate behavior on representative inputs |
| Agent Platform mechanism | Documented endpoint trafficSplit | Separate request-copying design required unless independently verified otherwise |

These are deployment concepts, not promises of zero downtime. Keeping candidate answers away from users says nothing by itself about whether the primary service stays available.

## What Agent Platform documents natively

The [deployment overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/general/deployment) describes deploying a replacement model to the same endpoint, starting with a small traffic share, then gradually increasing it. That is a natural foundation for a canary rollout.

The [Endpoint resource](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints) defines trafficSplit as a map from deployed-model IDs to percentages. Those percentages must total 100, unless the resource map is empty because the endpoint should not accept traffic. An omitted deployed-model ID receives no traffic through that split.

One API detail is easy to miss. In a [deployModel request](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints/deployModel), an empty trafficSplit leaves the existing allocation unchanged. A nonempty map replaces it. The special key "0" represents the model being deployed. Resource state and method input therefore have different empty-map meanings.

Endpoint choice also matters. The [endpoint comparison](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/choose-endpoint-type) lists traffic splitting for dedicated public, shared public, and dedicated private Private Service Connect endpoints. Private services access endpoints using VPC Network Peering do not support it. Do not reduce this to “private endpoints cannot split traffic”: PSC and private services access are different options.

## Shadow evaluation needs a separate design

The endpoint and deployment schemas reviewed for this article do not document a native request-mirroring control. This is a bounded documentation finding, not a claim about every Google Cloud service. Do not invent a shadow toggle or present ordinary traffic splitting as duplication.

The following is architectural reasoning, rather than a documented Agent Platform feature: an application can return the incumbent response while independently sending eligible inputs to a separately addressable candidate endpoint. Correlation IDs can connect the two predictions for later analysis.

Keep this secondary path isolated. Bound its concurrency, decide what happens when it times out, and prevent candidate outputs from triggering payments, messages, or other side effects. Check whether copied payloads contain sensitive data and whether the candidate service and logs are authorized to receive it. Extra inference and retained results also cost money.

## Walkthrough 1: a recommendation canary

Imagine a retailer testing a new recommendation ranker. This is an original hypothetical walkthrough, not an exam item. Offline evaluation is promising, and the team now needs evidence about live latency and customer behavior.

On a supported endpoint, it deploys incumbent and candidate models and explicitly assigns an illustrative 95/5 split. Those numbers are not a prescribed Google configuration. Before rollout, the team defines acceptable error rates, latency, and a business metric, plus a decision window and rollback criteria.

The candidate now answers some customers. If failures rise, the team restores the incumbent allocation instead of waiting for an aggregate conversion result. If early results are healthy, it increases exposure in controlled steps. Endpoint percentages alone should not be assumed to provide stable customer cohorts; design assignment separately if repeat-user consistency is necessary.

## Walkthrough 2: a support-routing shadow

Imagine a company replacing a model that routes support tickets. Incorrect candidate routing could send sensitive requests to the wrong queue, so the team first wants comparisons without changing the live decision.

Its application keeps using the incumbent result. An isolated secondary path copies a permitted sample of ticket inputs to a candidate endpoint and stores matched predictions. Candidate results never dispatch tickets. If that path fails, it drops or records the failed comparison rather than blocking primary routing.

The team examines disagreements and latency, then reviews outcomes once labels become available. Agreement with the incumbent is not proof of correctness: both models can make the same mistake. Shadow evaluation also cannot directly measure the customer effect of actually taking candidate actions. That may require a later controlled rollout.

## Traps worth separating

A zero-percent candidate is not receiving mirrored production inputs automatically. A 100-percent candidate allocation is a cutover, not a small canary. A shadow path can still damage availability if it blocks the primary path or exhausts shared capacity. And a [rolling deployment](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/rolling-deployment) is a separate, currently Preview mechanism for replacing a version while reusing compute—not another name for shadow evaluation.

## Which one does the PMLE exam expect?

The official [June 1, 2026 guide](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf) explicitly includes rollout strategies such as canary deployments under **4.1**. Related scope includes choosing deployment strategies in **3.1**, public and private serving endpoints in **4.2**, and monitoring and troubleshooting in **6.2**. Shadow deployment is not explicitly named. These mappings describe the published objectives, not what any unseen assessment item expects.

Review the [Agent Platform cheat sheet](/pmle/vertex-ai-agent-platform-cheat-sheet), explore [sample questions](/pmle/sample-questions), or take the free PMLE diagnostic and select its [5-question quick check](/diagnostic). For broader preparation, use the [study plan by domain](/blog/pmle-study-plan-by-domain) and [June 2026 exam changes](/blog/pmle-exam-changes-june-2026).


## Sources

All sources last checked October 18, 2026.

- [Traffic mirroring mechanics (Cloud Service Mesh)](https://docs.cloud.google.com/service-mesh/docs/service-routing/advanced-traffic-management)
- [Model deployment overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/general/deployment)
- [Endpoint REST resource](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints)
- [deployModel REST method](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints/deployModel)
- [Endpoint-type comparison](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/choose-endpoint-type)
- [Rolling deployment and Preview status](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/rolling-deployment)
- [PMLE exam guide as of June 1, 2026](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf)
