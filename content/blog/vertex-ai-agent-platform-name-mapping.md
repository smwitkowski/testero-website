---
title: "Vertex AI to Agent Platform: PMLE Name Mapping"
description: "Match old Vertex AI names to Google's current Agent Platform names, with official evidence and PMLE study guidance."
publishedAt: "2026-10-16"
updatedAt: "2026-10-16"
category: "Exam Preparation"
tags: ["PMLE", "Vertex AI", "Gemini Enterprise Agent Platform"]
author: "Testero Team"
citations: ["https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes", "https://cloud.google.com/learn/certification/machine-learning-engineer", "https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest", "https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/python-sdk/use-python-sdk"]
---


**Summary:** Google now lists explicit name changes from Vertex AI products to Gemini Enterprise Agent Platform. Use the official mapping table to translate older study notes, then use the current PMLE exam guide to decide what to study. Product labels, documentation paths, and code identifiers are separate things: a renamed service does not mean every string containing `vertex` or `aiplatform` should change.

Last checked October 16, 2026.

Testero is independent and not affiliated with Google.

## Why this matters for PMLE preparation

Google's Professional Machine Learning Engineer certification page says the exam was updated to reflect recent branding changes and tells candidates to review product names in the exam guide. The linked English guide is labeled **as of June 1, 2026**. That is the guide's stated date, not a launch date for the platform or a date when every product changed.

The guide uses Gemini Enterprise Agent Platform across conventional ML and generative AI objectives. For example, section 1.1 covers BigQuery ML or AutoML on the platform; section 2.2 names Workbench and Colab Enterprise for prototyping; section 2.3 includes experiments and pipelines. Don't read “Agent Platform” as permission to drop ordinary model training and MLOps from your preparation.

If you are deciding whether this credential fits your work, start with the [PMLE certification overview](/certifications/machine-learning-engineer). Use this article as a translation aid, not a replacement for its exam objectives.

## Verified old-name to new-name mappings

Every row below comes directly from Google's **Gemini Enterprise Agent Platform name changes** page. These are selected mappings relevant to reading ML study material, not a claim that this is the entire product catalog. The wording follows Google's table, including different placements of “on Gemini Enterprise Agent Platform.”

| Old name | New name | Official documentation |
| --- | --- | --- |
| Vertex AI Platform | Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI API | Gemini Enterprise Agent Platform API | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Model Garden | Gemini Enterprise Agent Platform Model Garden | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Training | Gemini Enterprise Agent Platform Managed Training | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Serverless Training | Gemini Enterprise Agent Platform Serverless Training | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Pipelines | Gemini Enterprise Agent Platform Pipelines | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Workbench | Gemini Enterprise Agent Platform Workbench | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Feature Store | Feature Store on Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Model Registry | Model Registry on Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Model Evaluation | Model Evaluation on Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Experiments | Experiments on Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Model Monitoring | Model Monitoring on Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI AutoML (Vision/Video/Tables) | AutoML on Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Batch Inference | Gemini Enterprise Agent Platform Batch Inference | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Online Inference | Gemini Enterprise Agent Platform Online Inference | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Agent Engine | Agent Runtime on Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Vector Search | Vector Search on Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |
| Vertex AI Vector Search 2.0 | Agent Retrieval on Gemini Enterprise Agent Platform | [Google name changes](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes) |

### Keep similar names separate

Two rows deserve extra care. Google maps **Vertex AI Vector Search** to **Vector Search on Gemini Enterprise Agent Platform**, but maps **Vertex AI Vector Search 2.0** to **Agent Retrieval on Gemini Enterprise Agent Platform**. Do not collapse both into one flashcard just because the old labels share words.

The table also maps **Vertex AI Agent Engine** to **Agent Runtime on Gemini Enterprise Agent Platform**. That is a specific naming entry, not a reason to interpret every occurrence of “agent,” “runtime,” or “engine” as the same service. When reading an example, retain its concrete resource and API context.

Google's page says *some* Vertex AI products and features have been renamed. Resist extending a verified row into a universal rule. A product missing from this selected table needs its own check against the official source; adding a new prefix yourself is not evidence.

## Why old URLs and code strings can still appear

The documentation itself demonstrates that names and technical identifiers can differ. During this check, Google's old `/vertex-ai/docs/start/introduction-unified-platform` URL redirected to the current machine-learning introduction under `/gemini-enterprise-agent-platform/machine-learning`. The old REST reference URL similarly redirected to the current Agent Platform REST reference.

That supports a narrow, useful conclusion: **those specific old links still resolved when checked**. It does not establish that every old Vertex AI URL redirects, or that an old tutorial remains correct in all other respects. Follow the destination and read the current instructions before using an example.

The current REST reference is titled **Agent Platform API**, but explicitly lists its service as `aiplatform.googleapis.com`. Its discovery-document URLs also use that hostname. Renaming an endpoint in your notes to make it look consistent with the product label would make the notes less accurate.

The current Python SDK instructions provide another concrete example. They tell readers to install `google-cloud-aiplatform` and import `from google.cloud import aiplatform`. They also show `import vertexai.preview` for preview features. Those exact strings are in the fetched official instructions; they are not inferred from a historical tutorial.

Do not take that as a promise that every old SDK module is supported indefinitely. Check the instructions for the particular feature and version you are using. The practical rule is simple: translate product names for understanding, but copy package names, import paths, and service identifiers from current technical documentation.

## Update your study notes without rewriting everything

### 1. Annotate the first old-name occurrence

Add the verified current name beside the old label. For example: “Vertex AI Pipelines → Gemini Enterprise Agent Platform Pipelines.” Keep the source link with the note. Avoid a global find-and-replace across code blocks, URLs, and prose; the SDK and API examples above show why those need different handling.

### 2. Reconnect the name to an exam task

For each renamed product, write the decision you need to understand. The guide's section 3.1 asks candidates to choose a product given cost, complexity, latency, and scalability. Section 2.3 asks about choosing an environment for experimentation and tracking artifacts, versions, and lineage. A useful note explains the choice, rather than merely repeating the new label.

For example, put your AutoML and BigQuery ML notes next to the low-code objectives. Put Workbench beside notebook prototyping. Put experiments and pipelines beside their corresponding collaboration objectives. This keeps the naming exercise tied to the guide instead of turning it into a separate vocabulary project.

### 3. Record unresolved differences explicitly

If an older resource uses a name you cannot locate in Google's mapping page, mark it “unverified” rather than guessing. If the current documentation and guide use slightly different phrasing, preserve the wording of each source. A naming table establishes the listed relationship; it does not prove identical capabilities, quotas, pricing, or behavior across versions.

Use the [certification hub](/certifications) if you are comparing credentials. For this exam, return to the PMLE objectives after translating names. The goal is to recognize the service and reason about its role in the solution—not to make every source look linguistically identical.

## Sources

- [Google's official name-change table](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes)
- [Professional Machine Learning Engineer certification](https://cloud.google.com/learn/certification/machine-learning-engineer)
- [Current English PMLE exam guide](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf)
- [Machine-learning introduction](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning)
- [Agent Platform REST API reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest)
- [Python SDK instructions](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/python-sdk/use-python-sdk)

Ready to check your PMLE preparation? Start the [free PMLE diagnostic](/diagnostic).
