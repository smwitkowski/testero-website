---
title: "Professional Data Engineer exam guide (2026)"
description: "A practical PDE standard exam guide: verified format, every exam section, and preparation exercises grounded in Google sources."
publishedAt: "2026-10-16"
updatedAt: "2026-10-16"
category: "Exam Guides"
tags: ["Google Cloud", "PDE", "Certification"]
author: "Testero"
citations: ["https://cloud.google.com/learn/certification/data-engineer", "https://services.google.com/fh/files/misc/professional_data_engineer_exam_guide_english.pdf"]
---


## Summary

The Professional Data Engineer (PDE) standard exam covers the data lifecycle: system design, ingestion and processing, storage, analytical use, and ongoing workload operation. The current guide includes preparation for AI and ML, but it is not limited to model-related data. Security, governance, reliability, costs, and repeatability run through the whole blueprint.

Last checked October 16, 2026.

Testero is independent and not affiliated with Google.

## Standard exam format and recommended experience

Google lists a two-hour standard exam with 40–50 multiple-choice and multiple-select questions. The registration fee is $200 plus applicable tax. English and Japanese are available. Delivery can be online-proctored from a remote location or onsite-proctored at a testing center. Certification validity is two years.

There are no prerequisites. Google recommends three or more years of industry experience, including at least one year designing and managing solutions using Google Cloud. That recommendation is not a mandatory eligibility rule. The sections and percentages in this article come from the standard guide, not the separate renewal guide.

Use the [PDE certification page](/certifications/data-engineer) for an internal reference. If your responsibility is architecture across many systems rather than the data platform itself, compare the [PCA certification page](/certifications/cloud-architect) before deciding which blueprint fits your work.

## The five standard exam sections

The percentages below are approximate. Every scenario is an illustrative study exercise, not an actual exam question. Use the examples to practice explaining a decision and its failure modes, rather than memorizing a single supposed answer.

### 1. Designing data processing systems — approximately 22%

Design starts with security and compliance: IAM, organization policies, encryption, personal information, data sovereignty, legal constraints, and governance across projects, datasets, and tables. Development and production environments are explicitly part of the scope.

Reliability and fidelity include cleaning, orchestration, monitoring, recovery, fault tolerance, transaction-property decisions, and data validation. Flexibility covers business changes, portability, residency, staging, cataloging, profiling, and discovery. Migration planning asks you to understand the current stakeholders, processes, and technology before planning movement and validation.

For an exercise, imagine moving a departmental reporting pipeline into a shared platform. Write down who owns the source, who can access each stage, what must remain in a particular region, and how the team will validate the migrated data. Then consider a source schema change. Explain what should be detected and who needs to know before the changed data reaches reports.

The important habit is to define correctness before choosing tools. A pipeline that completes successfully is not necessarily producing data that meets the business requirement. Make validation criteria part of the architecture notes rather than leaving them for the final deployment task.

### 2. Ingesting and processing the data — approximately 25%

This is the largest section. Planning includes sources, sinks, transformations, orchestration, networking, and encryption. Building includes cleansing, acquisition, new-source integration, processing logic, and AI enrichment. The guide names services and technologies including Dataflow, Apache Beam, Dataproc, Cloud Data Fusion, BigQuery, Pub/Sub, Spark, Hadoop, and Kafka.

Both batch and streaming transformations are covered. Streaming objectives explicitly include windowing and late-arriving data. Operationalizing the pipeline adds automation, Cloud Composer or Workflows orchestration, and CI/CD.

An illustrative scenario: events arrive continuously, while a daily file supplies reference data. Describe the required outputs, what happens when a reference file is delayed, and how late events should affect results. Compare processing approaches using those requirements. Do not call a pipeline “real time” without defining the freshness expectation in your exercise.

Prepare a deployment story as well as a transformation diagram. State how the job is launched, how its dependencies are represented, what validation runs before promotion, and what evidence tells you the new version is doing the intended work.

### 3. Storing the data — approximately 20%

Storage selection starts with access patterns, costs, performance, and lifecycle management. The guide includes managed services such as BigQuery, BigLake, AlloyDB, Bigtable, Spanner, Cloud SQL, Cloud Storage, Firestore, and Memorystore. The point is not to fit every service into one system; it is to select an appropriate design from requirements.

Warehouse planning covers models, normalization decisions, business needs, and access patterns. Data lakes add discovery, access and cost controls, processing, and monitoring. Platform design includes Google Cloud tooling such as Dataplex, Dataplex Catalog, BigQuery, and Cloud Storage, with federated governance for distributed systems.

Use an exercise with raw files, operational records, and curated reporting data. Identify each consumer and access pattern before choosing storage. Write retention and access expectations alongside the diagram. Then explain how people will discover the data and identify its owner. A list of buckets and tables is not yet a governance model.

### 4. Preparing and using data for analysis — approximately 15%

This section connects stored data to its consumers. Visualization preparation includes tool connectivity, precalculated fields, BI Engine, materialized views, query performance, masking, IAM, and sensitive-data protection. AI and ML preparation includes feature engineering, training and serving data, BigQuery ML, and unstructured data for embeddings and retrieval-augmented generation.

Sharing includes rules, published datasets, reports, visualizations, and BigQuery sharing through Analytics Hub. This means analytical convenience and access boundaries belong in the same preparation exercise, not separate notebooks that never meet.

For an illustrative task, produce a plan for a curated dataset used by analysts and an AI application. Specify the fields each consumer needs, the transformations to check, the access rules, and the query-performance evidence to collect. For unstructured inputs, state what preparation is needed before they become useful to a retrieval workflow. Keep the exercise grounded in the guide's data-preparation scope rather than turning it into a model-training syllabus.

### 5. Maintaining and automating data workloads — approximately 18%

Operational work includes minimizing cost for a business requirement, ensuring resource availability, and choosing persistent versus job-based clusters. Repeatability includes Cloud Composer DAGs and reliable scheduling. Workload organization covers BigQuery Editions and reservations, capacity management, and interactive versus batch query jobs.

Monitoring and troubleshooting include Cloud Monitoring, Cloud Logging, the BigQuery administration interface, expected usage, errors, billing, quotas, jobs, queries, and reservations. Failure mitigation covers restarts, regional or zonal placement, corruption, missing data, replication, and failover.

Practice a failure review: the morning report is incomplete, although yesterday's run finished. Decide how you would distinguish missing input, transformation failure, access failure, and resource limits. Define the checks before proposing a restart. Then describe how you would validate the repaired result and prevent an unnoticed repeat. The purpose is a controlled recovery plan, not a reflex to rerun everything.

## Build a preparation loop around evidence

Start with the standard guide and turn each subsection into a question you can answer about a small data system. For example: what is the validation rule, who owns the dataset, what happens when a job fails, and how is capacity assigned? Mark gaps by objective instead of measuring preparation only by completed videos.

Use Google's Data Engineer learning path and sample questions, both linked from the certification page. Samples help with format familiarization. Pair them with your own diagrams, transformation notes, validation plans, and failure reviews. Revisit the official guide when a course uses an unfamiliar or older product label.

## PDE versus PMLE

PDE includes data preparation for AI and ML within a broader data-platform remit. Compare the [PMLE certification page](/certifications/machine-learning-engineer) if your intended focus is machine learning. This is a suggested role comparison, not a claim that either certification is a prerequisite for the other.

## Sources

- https://cloud.google.com/learn/certification/data-engineer
- https://services.google.com/fh/files/misc/professional_data_engineer_exam_guide_english.pdf

## Next step

Use the notify form on the [Professional Data Engineer page](/certifications/data-engineer) to hear when its diagnostic is ready.
