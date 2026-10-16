---
title: "Associate Cloud Engineer exam guide (2026)"
description: "A practical ACE standard exam guide: verified format, every exam section, and preparation exercises grounded in Google sources."
publishedAt: "2026-10-16"
updatedAt: "2026-10-16"
category: "Exam Guides"
tags: ["Google Cloud", "ACE", "Certification"]
author: "Testero"
citations: ["https://cloud.google.com/learn/certification/cloud-engineer", "https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf"]
---


## Summary

The Associate Cloud Engineer (ACE) standard exam is about setting up, deploying, operating, and securing Google Cloud solutions. The current guide has four sections, not a separate planning-only domain. Implementation and operations each account for approximately 30%, so preparation should include changing a working environment, not just recognizing service names.

Last checked October 16, 2026.

Testero is independent and not affiliated with Google.

## Standard exam format and scope

Google lists a two-hour exam with 50–60 multiple-choice and multiple-select questions. Registration costs $125 plus applicable tax. The standard exam is available in English, Japanese, Spanish, and Portuguese, with remote online proctoring or onsite proctoring at a testing center. Certification validity is three years.

There are no prerequisites. Google recommends at least six months of hands-on Google Cloud experience. Treat that as preparation guidance, not an eligibility requirement or a promise that a particular amount of experience makes you ready. This article uses the standard exam guide throughout; it does not substitute renewal-exam objectives or timing.

Start with the [ACE certification page](/certifications/cloud-engineer) for a compact reference. If you are comparing responsibilities, the [Cloud Architect certification](/certifications/cloud-architect) is a useful next comparison. Do not choose a professional-level exam just because its title sounds like the next mandatory step.

## The four standard exam sections

The percentages below are approximate weights from Google's standard guide. The exercises are illustrative preparation scenarios, not actual exam questions.

### 1. Setting up a cloud solution environment — approximately 20%

This section covers the foundations that make later deployments possible: resource hierarchy, organization policies, project IAM, Cloud Identity users and groups, API enablement, quotas, regional availability, networking, and observability setup. It also includes Workforce Identity Federation and resource analysis with Cloud Asset Inventory and Gemini Cloud Assist.

Billing is part of the environment, not an administrative afterthought. Be able to explain how billing accounts relate to projects, and how budgets, alerts, and billing exports fit into a team's cost-management workflow.

For an illustrative exercise, describe how you would prepare separate development and production projects for a small application team. Identify the hierarchy, who needs access, which APIs must be enabled, where availability needs checking, and where billing visibility belongs. Write down the assumptions before opening the console. The useful artifact is a setup checklist someone else could review, not a screenshot of a completed wizard.

### 2. Planning and implementing a cloud solution — approximately 30%

Here the guide moves from foundations into resource choices and deployment. Compute objectives include Compute Engine, GKE, Cloud Run, Cloud Run functions, managed instance groups, instance storage, OS Login, VM Manager, Kubernetes tooling, event-driven deployments, and GPU-versus-TPU selection. The current guide also names Agent Runtime on Gemini Enterprise Agent Platform, formerly Vertex AI Agent Engine.

Storage and data coverage includes choosing and deploying database and processing products, selecting storage products and classes, loading data, and planning multi-region redundancy. Networking includes VPCs and subnets, Shared VPC, peering, firewall rules and Cloud NGFW policies, hybrid connectivity, load balancers, and Network Service Tiers. Tooling includes infrastructure as code and AI-assisted implementation.

Practice with one workload that has explicit constraints: a containerized application, a data store, and a private backend dependency. Compare two deployment approaches against those constraints. Then outline how you would provision the chosen resources reproducibly. Avoid an answer that lists every service without explaining which requirement made it appropriate.

### 3. Ensuring the successful operation of a cloud solution — approximately 30%

Deployment is only the beginning of this domain. You need to reason about VM access, snapshots and images, GKE inventory and node pools, Kubernetes resources and autoscaling, Cloud Run revisions and traffic splitting, and resource configuration for AI workloads and developer environments.

Data operations include securing storage objects, lifecycle policies, querying data, estimating storage costs, backup and restore, reviewing job status, Database Center, and customer-managed encryption keys. Networking operations include subnet expansion, static addresses, routes, Cloud DNS, Cloud NAT, and firewall management.

Monitoring and logging are substantial: alerts, custom metrics, audit and network logs, log routing and exports, diagnostic tools, Ops Agent, managed Prometheus, service-health views, and resource optimization all appear in the guide.

An illustrative incident exercise: a new application revision behaves poorly after deployment. Decide which metrics and logs you would inspect, how you would identify the affected resources, and what traffic-management action you would consider. Separate evidence gathering from remediation. A command you remember is less useful than a clear explanation of why it is the next command to run.

### 4. Configuring access and security — approximately 20%

This domain focuses on IAM policies, role types, hierarchy inheritance, custom roles, and service accounts. Service-account objectives include minimum permissions, assignment to resources, impersonation, short-lived credentials, GKE application identity, and Workload Identity Federation.

Use an access-review exercise: an application needs a narrowly defined operation on a resource. Identify the caller, the role, the resource scope, and the credential path. Then explain how inherited permissions could affect your review. Keep workforce access and workload access distinct in your notes rather than treating every identity as a human user with a downloaded key.

## Prepare around tasks you can explain

Build a checklist from all four sections. For each objective, record whether you can perform the task, explain its purpose, and investigate a failure. These are three different checks. Familiarity with a product name does not establish operational fluency.

Use Google's Cloud Engineer learning path, linked from the certification page, to fill specific gaps. Pair study with a small, disposable environment where you can rehearse setup, deployment, monitoring, access changes, and cleanup. Define the exercise before creating resources, including the evidence you want to collect and what you will remove afterward.

For final review, use Google's linked sample questions to learn the response format. When reviewing an error, classify it: misunderstood requirement, weak product knowledge, missed permission boundary, or failure to notice multiple selections. Return to the relevant guide objective rather than repeatedly rereading a broad course.

## ACE versus PMLE: choose the work, not the acronym

Use ACE's deployment and operations objectives as the role anchor. If your intended work is specifically machine learning, compare that scope with the [PMLE certification page](/certifications/machine-learning-engineer) instead of assuming ACE is a required prerequisite. This is a role-selection suggestion, not a certification sequence imposed by Google.

## Sources

- https://cloud.google.com/learn/certification/cloud-engineer
- https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf

## Next step

Want an ACE diagnostic when it becomes available? Use the notify form on the [Associate Cloud Engineer page](/certifications/cloud-engineer).
