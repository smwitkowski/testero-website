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

Use **canary** when the candidate should answer a small share of live requests. Use **shadow evaluation** when you need predictions on copied inputs without changing user-facing decisions. The choice depends on whether candidate results should affect users, not just whether deployment needs zero downtime.

Last checked October 18, 2026.

Testero is independent and not affiliated with Google.

Agent Platform here means Gemini Enterprise Agent Platform's model inference services. For the current product names, see the [Vertex AI name-mapping guide](/blog/vertex-ai-agent-platform-name-mapping).

## Start with who answers the user

A canary model serves a small share of real requests. Its output can affect users, so a canary tests both model behavior and the consequences of using that behavior. You increase its share only after collecting enough evidence.

In a shadow design, the candidate receives copied inputs while the application continues returning the incumbent response. [Cloud Service Mesh traffic mirroring](https://docs.cloud.google.com/service-mesh/docs/service-routing/advanced-traffic-management) shows this pattern: send an identical request to a mirror backend without waiting for its response. On Agent Platform, build the copying path in your application as described below.

| Question | Canary | Shadow evaluation |
|---|---|---|
| Does the candidate answer users? | Yes, for its assigned traffic | No, if the application isolates its output |
| Are requests duplicated? | Not by traffic splitting itself | Yes, for the sampled inputs being compared |
| What does it reveal? | Real serving and user-impact evidence | Candidate behavior on representative inputs |
| Agent Platform mechanism | Documented endpoint trafficSplit | Application copies requests to the candidate |

Keeping candidate answers away from users protects decisions. Availability still depends on how you isolate the extra work.

## Use endpoint traffic splitting for canaries

The [deployment overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/general/deployment) describes deploying a replacement model to the same endpoint, starting with a small traffic share, then gradually increasing it. Use that traffic split to run a canary.

The [Endpoint resource](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints) defines trafficSplit as a map from deployed-model IDs to percentages. Those percentages must total 100, unless the resource map is empty because the endpoint should not accept traffic. An omitted deployed-model ID receives no traffic through that split.

In a [deployModel request](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints/deployModel), an empty trafficSplit leaves the existing allocation unchanged. A nonempty map replaces it. The special key "0" represents the model being deployed. Resource state and method input therefore have different empty-map meanings.

Endpoint choice also matters. The [endpoint comparison](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/choose-endpoint-type) lists traffic splitting for dedicated public, shared public, and dedicated private Private Service Connect endpoints. Private services access endpoints using VPC Network Peering do not support it. Do not reduce this to “private endpoints cannot split traffic”: PSC and private services access are different options.

## Shadow evaluation needs a separate design

Endpoint traffic splitting routes requests; it does not mirror them. Build shadow testing in your application: return the incumbent response and send eligible inputs asynchronously to a separately addressable candidate endpoint. Use correlation IDs to match the two predictions for analysis.

Keep this secondary path isolated. Bound its concurrency, decide what happens when it times out, and prevent candidate outputs from triggering payments, messages, or other side effects. Check whether copied payloads contain sensitive data and whether the candidate service and logs are authorized to receive it. Extra inference and retained results also cost money.

## Walkthrough 1: a recommendation canary

A retailer is testing a new recommendation ranker. Offline evaluation is promising. The team now needs evidence about live latency and customer behavior.

It deploys both models to a supported endpoint and starts with 95% of traffic on the incumbent and 5% on the candidate. Before rollout, the team defines acceptable error rates, latency, and a business metric, plus a decision window and rollback criteria.

The candidate now answers some customers. If failures rise, the team restores the incumbent allocation instead of waiting for an aggregate conversion result. If early results are healthy, it increases exposure in controlled steps. Endpoint percentages do not guarantee stable customer cohorts. Add user-level assignment if returning customers need consistent recommendations.

## Walkthrough 2: a support-routing shadow

A company is replacing a model that routes support tickets. Incorrect candidate routing could send sensitive requests to the wrong queue, so the team first wants comparisons without changing the live decision.

Its application keeps using the incumbent result. An isolated secondary path copies a permitted sample of ticket inputs to a candidate endpoint and stores matched predictions. Candidate results never dispatch tickets. If that path fails, it drops or records the failed comparison rather than blocking primary routing.

The team examines disagreements and latency, then reviews outcomes once labels become available. Agreement with the incumbent is not proof of correctness: both models can make the same mistake. Shadow evaluation also cannot directly measure the customer effect of actually taking candidate actions. That may require a later controlled rollout.

## Traps worth separating

Deploying a model with zero traffic does not test it. A 100-percent candidate allocation is a cutover, not a small canary. A [rolling deployment](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/rolling-deployment) is a separate, currently Preview mechanism for replacing a version while reusing compute—not another name for shadow evaluation.

## Map the decision to the June 2026 guide

The official [June 1, 2026 guide](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf) explicitly includes rollout strategies such as canary deployments under **4.1**. Related scope includes choosing deployment strategies in **3.1**, public and private serving endpoints in **4.2**, and monitoring and troubleshooting in **6.2**. Shadow deployment is not explicitly named. For a rollout question, identify who receives candidate answers, how traffic reaches the candidate, and what evidence the team needs before increasing exposure.

Review the [Agent Platform cheat sheet](/pmle/vertex-ai-agent-platform-cheat-sheet), explore [sample questions](/pmle/sample-questions), or take the free PMLE diagnostic and select its [5-question quick check](/diagnostic). For broader preparation, use the [study plan by domain](/blog/pmle-study-plan-by-domain) and [June 2026 exam changes](/blog/pmle-exam-changes-june-2026).


## Sources

- [Traffic mirroring mechanics (Cloud Service Mesh)](https://docs.cloud.google.com/service-mesh/docs/service-routing/advanced-traffic-management)
- [Model deployment overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/general/deployment)
- [Endpoint REST resource](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints)
- [deployModel REST method](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints/deployModel)
- [Endpoint-type comparison](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/choose-endpoint-type)
- [Rolling deployment and Preview status](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/rolling-deployment)
- [PMLE exam guide as of June 1, 2026](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf)
