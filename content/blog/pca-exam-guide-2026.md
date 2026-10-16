---
title: "Professional Cloud Architect exam guide (2026)"
description: "A practical PCA standard exam guide: verified format, every exam section, and preparation exercises grounded in Google sources."
publishedAt: "2026-10-16"
updatedAt: "2026-10-16"
category: "Exam Guides"
tags: ["Google Cloud", "PCA", "Certification"]
author: "Testero"
citations: ["https://cloud.google.com/learn/certification/cloud-architect", "https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf"]
---


## Summary

The Professional Cloud Architect (PCA) standard exam connects architecture choices to business requirements, security, implementation, and production operations. Its current guide contains six sections and explicitly calls for familiarity with the Google Cloud Well-Architected Framework. Prepare to defend a design against constraints, not just draw a diagram full of product names.

Last checked October 16, 2026.

Testero is independent and not affiliated with Google.

## Standard exam format

Google lists two hours, 50–60 multiple-choice and multiple-select questions, and a $200 registration fee plus applicable tax. The standard exam is offered in English and Japanese, remotely with online proctoring or onsite at a testing center. Certification validity is two years. There are no prerequisites; recommended experience is three or more years in industry, including at least one year designing and managing Google Cloud solutions.

The standard exam includes two case studies. Google says case-study questions account for 20–30% of the exam, and the case studies can be viewed on a split screen. The standard guide lists four possible case studies: Altostrat Media, Cymbal Retail, EHR Healthcare, and KnightMotives Automotive. Use those current names rather than an older preparation list.

This article covers the standard exam only. Do not mix its six-section blueprint or case-study information with a renewal guide. The [PCA certification page](/certifications/cloud-architect) is the internal reference for this certification; the [ACE certification page](/certifications/cloud-engineer) provides a useful comparison if your work is more deployment-focused.

## Understand all six sections

Weights are approximate. The scenarios below are invented study exercises, not actual exam questions or summaries of Google's named case-study businesses.

### 1. Designing and planning a cloud solution architecture — approximately 25%

The largest section starts with business use cases, product strategy, functional and non-functional requirements, continuity, cost, integration, data movement, trade-offs, and success measurements. Technical design adds availability, failover, scale, latency, backup, recovery, and the Well-Architected Framework.

You also need to select network, storage, compute, data-processing, and AI solutions. Migration planning includes dependencies, testing, network plans, existing-system integration, licensing, and financial effects. Future improvements must account for changing technology and business needs.

As an exercise, imagine a company moving a customer-facing application while keeping a dependency on premises. Write the business requirements first. Then compare two architectures against availability, latency, cost, security, and migration constraints. Include what you would measure after launch. If a requirement changes, show which design choice changes with it. That is more valuable than deciding on a favorite platform before reading the brief.

### 2. Managing and provisioning a cloud solution infrastructure — approximately 17.5%

This section makes architecture concrete. Network topics cover hybrid and multicloud topologies, protection, VPC design, and load balancing. Storage configuration includes allocation, processing resources, access, transfer latency, retention, growth, and recovery. Compute includes provisioning, Spot-versus-standard choices, networking, orchestration, patching, containers, and serverless systems.

The current guide also includes Gemini Enterprise Agent Platform for end-to-end ML workflows, pipeline orchestration, data integration, and AI Hypercomputer considerations. Prebuilt AI solutions and APIs, Gemini Enterprise features, and Model Garden integration are explicitly in scope.

For practice, take your proposed architecture and write an implementation inventory: networks, compute, storage, identities, dependencies, and deployment tooling. For an AI component, state whether the requirement calls for a prebuilt capability or a more customized workflow. Do not add AI merely because it appears in the blueprint; explain the business need it serves.

### 3. Designing for security and compliance — approximately 17.5%

Security includes IAM, resource hierarchy, encryption and key management, secrets, separation of duties, auditing, organization policies, VPC Service Controls, secure remote access, and software-supply-chain security. The guide also covers securing AI, including Model Armor, Sensitive Data Protection, and secure model deployment.

Compliance objectives span legislation, privacy, sovereignty, commercial handling of sensitive data, industry certifications, and audit logs. Treat these as design inputs, not a final checklist pasted onto an otherwise complete solution.

An illustrative review: a team wants to use sensitive customer records in a new workflow. Identify the access boundaries, data location requirements, audit evidence, encryption ownership, and separate duties before choosing the components. Be explicit about facts you would need from a security or compliance stakeholder. A product name alone is not a compliance argument.

### 4. Analyzing and optimizing technical and business processes — approximately 15%

Technical processes include the software development lifecycle, CI/CD, root-cause analysis, validation, service provisioning, and disaster recovery. Business processes include stakeholder engagement, change management, team readiness, decision-making, customer success, resource costs, and continuity.

Practice explaining why a technically reasonable architecture could still fail during adoption. For example, a proposed migration might depend on skills the operating team does not yet have. Write a staged plan with ownership, validation, and a decision point. Keep recovery of the system separate from continuity of the business, even when the plans overlap.

### 5. Managing implementation — approximately 12.5%

This domain covers advising delivery teams on deployment, API management, testing, migration tooling, and Gemini Cloud Assist. Programmatic interaction includes Cloud Shell and development tools, Google Cloud SDKs, emulators, infrastructure as code, API practices, and client libraries.

Turn a design into a short delivery plan. Explain what gets provisioned first, which integration needs testing, how the team validates the deployment, and how changes are represented reproducibly. The preparation goal is to bridge the architecture document and working implementation, not to memorize every CLI option.

### 6. Ensuring solution and operations excellence — approximately 12.5%

The last section includes the operational-excellence pillar of the Well-Architected Framework, observability, monitoring, logging, profiling, benchmarking, alerting, release management, support, quality control, and production reliability testing.

Use a post-launch exercise: traffic grows and performance becomes inconsistent. State which evidence would distinguish a capacity problem from a release regression, which teams own the response, and how you would evaluate the resulting change. Include reliability testing in your review, rather than treating production monitoring as the entire operational strategy.

## Prepare with architecture decisions and current case studies

Google's guide names six framework pillars: operational excellence, security, reliability, performance optimization, cost optimization, and sustainability. Use them to review your own design notes. Record the trade-off and the requirement behind each major choice; a design can be defensible without pretending every pillar improves simultaneously.

Read the four case studies linked from the standard guide. Build a table of stated business goals, existing systems, technical requirements, and unresolved assumptions. Do not invent requirements to justify a preferred service. Then practice explaining why a plausible alternative is weaker under those specific constraints.

Use Google's learning path and sample questions linked from the certification page. Treat samples as format familiarization, then revisit any weak domain with an implementation or design exercise.

## PCA versus PMLE

PCA's blueprint includes AI infrastructure but remains broad architecture work. Compare the [PMLE certification page](/certifications/machine-learning-engineer) if machine learning is your intended specialization. Choose using the objectives and the work you want to do, not the presence of AI product names alone.

## Sources

- https://cloud.google.com/learn/certification/cloud-architect
- https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf

## Next step

Use the notify form on the [Professional Cloud Architect page](/certifications/cloud-architect) to hear when its diagnostic is ready.
