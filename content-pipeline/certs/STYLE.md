# Google Cloud question style: measured samples and authoring rules

**Sample research retrieval date: 2026-10-04. Authoring policy updated: 2026-10-05.**

This document measures the official public sample forms linked by all 15 certifications on the [Google Cloud certification index](https://cloud.google.com/learn/certification). The measurements guide original, docs-grounded authoring. The rules-v3 S1–S10/O1–O5 rules below are founder authoring policy, not measured sample frequencies. Generation still creates DRAFT candidates only; it never publishes or replaces human approval.

## Evidence boundary

- **Samples are style evidence, not a live-exam blueprint or answer authority.** Sample counts, lengths, and rates below describe the published samples only. Small samples, especially the eight ML and six Security Operations items, cannot establish live-exam frequencies.
- Use the current certification page and exam guide for whole-exam format, objectives, and versions. Use current official product documentation to support an original question's correct answer and to reject each distractor. A published sample can use older terminology or context.
- Raw form HTML stays in the gitignored `content-pipeline/.cache/cert-registry/` cache. No official sample stems, options, answers, or case-study prose are reproduced here. Only measurements, source links, case names, and short qualifier phrases are retained.
- No form submissions, grading endpoints, restricted answer keys, login, or access-control bypass were used. The central registry builder alone fetched sources sequentially. This analysis made no network requests.

## How the measurements were made

1. Parse the public `FB_PUBLIC_LOAD_DATA_` value from cached form HTML. Inspect the form-wide item array, including later pages, rather than just visible first-page DOM. Recursively check nested public arrays for additional choice item IDs; no additional choice IDs were found.
2. Count assessment items with selectable answer options. Exclude registration fields, name/email/employer, relationship to Google, marketing consent, introductory text, page boundaries, images without answer controls, and case-study reference instructions. All non-choice fields in these forms were registration/consent, not free-response assessment questions. Workspace has one radio-button intake item that is excluded.
3. Deduplicate the Database form's tracking-query alias. Shortlinks for Workspace and Generative AI resolved to the public forms cited below. The Agentic Architect `preview` link resolved to a public `viewform`; it needed no login or submission.
4. **Stem length:** count Unicode letter/number word tokens; internal apostrophes and hyphens stay in one token. Decode HTML entities. Count the item's text title only. Remove explicit `choose/select two/three/2/3` instructions. Keep workload constraints, service names, task wording, and inline lists. Do not count answer options, page/context instructions, case-study references, or the external case-study summary. These are ranges over available text stems, not total reading burden.
5. **Options:** count selectable options, not distinct services or steps within an option. `4×19` means 19 items each have four options. A multi-step option still counts as one option.
6. **Multiple-select evidence:** `B` is public checkbox type (Forms type 4); `E` is explicit choose-N text; `U` is their union. Forms radio type is 2. Do not infer selection count from five options, plural wording alone, or assumed answers. Two items explicitly say choose two despite radio controls (Cloud Engineer #20 and DevOps #8). Developer #32 has checkbox controls but an image-only stem, so its choose-N instruction is unknown. Explicit text specifies two for the 14 measurable choose-N items. `U/N` is the reported sample share, not a format prediction.
7. **Scenario/recall:** manual classification, not an LLM score. A scenario states a concrete task, incident, constraint, or example whose details are used to choose an action or identify a concept. Recall asks for a definition, general feature/benefit, fact, or policy criterion without requiring the stated context. An organization wrapper alone does not make a scenario. Concrete classification examples can be scenarios even at foundational level. Ambiguous benefit/definition wrappers follow the recall rule. Image-only stems remain unknown, never guessed from their options.

The manual recall audit uses assessment-item order, after intake exclusion: Cloud Digital Leader #1,2,3,6,7,8,13,14,16,17,22,24,27,28,29; Generative AI Leader #2,4,16,18,24; Cloud Security Engineer #11. All other available text stems are classified as scenarios. Unknowns are Cloud Architect #2 and Cloud Developer #15,32,39. This rule is subjective; the ordinal list makes the judgment reviewable without storing question text.

## Per-certification sample measurements

All 15 forms were available and their public arrays parsed. No certification was blocked. **324 assessment items; 320 text stems.** Four image-only stems have **NULL** textual length and scenario/recall classification. Their options and control types are measurable. No external image assets were fetched. The ranges below exclude those four, rather than treating them as zero-length or inventing text.

`N` = assessment items; `Text` = measured text stems; `Words` = stem range; `B/E/U` = checkbox/explicit choose-N/union counts; final column = scenario/recall/unknown counts.

| Certification / official sample source | N | Text | Words | Options | B/E/U (U/N) | Scenario/recall/unknown |
|---|---:|---:|---:|---|---|---|
| [Cloud Digital Leader][S01] | 29 | 29 | 8–46 | 4×29 | 0/0/0 (0.00%) | 14/15/0 |
| [Generative AI Leader][S02] | 25 | 25 | 4–86 | 4×25 | 0/0/0 (0.00%) | 20/5/0 |
| [Associate Cloud Engineer][S03] | 20 | 20 | 24–67 | 4×19, 5×1 | 0/1/1 (5.00%) | 20/0/0 |
| [Associate Google Workspace Administrator][S04] | 27 | 27 | 28–94 | 4×27 | 0/0/0 (0.00%) | 27/0/0 |
| [Associate Data Practitioner][S05] | 19 | 19 | 34–101 | 4×19 | 0/0/0 (0.00%) | 19/0/0 |
| [Professional Agentic Architect (Beta)][S06] | 10 | 10 | 33–92 | 4×10 | 0/0/0 (0.00%) | 10/0/0 |
| [Professional Cloud Architect][S07] | 19 | 18 | 28–109 | 4×16, 5×3 | 3/3/3 (15.79%) | 18/0/1 |
| [Professional Cloud Database Engineer][S08] | 20 | 20 | 33–71 | 4×19, 5×1 | 1/1/1 (5.00%) | 20/0/0 |
| [Professional Cloud Developer][S09] | 50 | 47 | 25–151 | 4×44, 5×5, 6×1 | 5/4/5 (10.00%) | 47/0/3 |
| [Professional Data Engineer][S10] | 26 | 26 | 26–116 | 4×25, 5×1 | 1/1/1 (3.85%) | 26/0/0 |
| [Professional Cloud DevOps Engineer][S11] | 20 | 20 | 32–90 | 4×19, 5×1 | 0/1/1 (5.00%) | 20/0/0 |
| [Professional Cloud Security Engineer][S12] | 20 | 20 | 11–81 | 4×20 | 1/1/1 (5.00%) | 19/1/0 |
| [Professional Cloud Network Engineer][S13] | 25 | 25 | 33–100 | 4×23, 5×2 | 2/2/2 (8.00%) | 25/0/0 |
| [Professional Machine Learning Engineer][S14] | 8 | 8 | 52–103 | 4×8 | 0/0/0 (0.00%) | 8/0/0 |
| [Professional Security Operations Engineer][S15] | 6 | 6 | 40–87 | 4×6 | 0/0/0 (0.00%) | 6/0/0 |

### Family aggregates (item-weighted, not averages of cert percentages)

| Family | N / text | Words | Options | B/E/U (U/N) | Scenario/recall/unknown |
|---|---:|---:|---|---|---|
| Foundational: Digital + Generative AI Leaders | 54 / 54 | 4–86 | 4×54 | 0/0/0 (0.00%) | 34/20/0 |
| Associate: Cloud + Workspace + Data | 66 / 66 | 24–101 | 4×65, 5×1 | 0/1/1 (1.52%) | 66/0/0 |
| Professional, including Agentic Architect Beta | 204 / 200 | 11–151 | 4×190, 5×13, 6×1 | 13/13/14 (6.86%) | 199/1/4 |
| Total | 324 / 320 | 4–151 | 4×309, 5×14, 6×1 | 13/14/15 (4.63%) | 299/21/4 |

Among classifiable text items, scenario shares are 34/54 (62.96%) foundational, 66/66 (100%) associate, 199/200 (99.50%) professional, and 299/320 (93.44%) overall. These are **manual sample classifications, not representative exam rates**. A zero observed multi-select count does not mean the live exam lacks multi-select questions.

## Whole-exam facts: separate sources, separate claims

The [certification pages](https://cloud.google.com/learn/certification), not sample proportions, state these formats at retrieval:

- [Generative AI Leader](https://cloud.google.com/learn/certification/generative-ai-leader): 50–60 multiple-choice questions.
- [Professional Agentic Architect Beta](https://cloud.google.com/learn/certification/agentic-architect/): approximately 80 multiple-choice questions. Treat beta as its own version; do not silently apply stable-exam assumptions.
- [Professional Data Engineer](https://cloud.google.com/certification/data-engineer): 40–50 multiple-choice and multiple-select questions.
- The other 12 current certifications state 50–60 multiple-choice and multiple-select questions: [Digital Leader](https://cloud.google.com/certification/cloud-digital-leader), [Cloud Engineer](https://cloud.google.com/certification/cloud-engineer), [Workspace Administrator](https://cloud.google.com/certification/associate-google-workspace-administrator), [Data Practitioner](https://cloud.google.com/learn/certification/data-practitioner), [Cloud Architect](https://cloud.google.com/certification/cloud-architect), [Database Engineer](https://cloud.google.com/certification/cloud-database-engineer), [Cloud Developer](https://cloud.google.com/certification/cloud-developer), [DevOps Engineer](https://cloud.google.com/certification/cloud-devops-engineer), [Security Engineer](https://cloud.google.com/certification/cloud-security-engineer), [Network Engineer](https://cloud.google.com/certification/cloud-network-engineer), [ML Engineer](https://cloud.google.com/certification/machine-learning-engineer), and [Security Operations Engineer](https://cloud.google.com/learn/certification/security-operations-engineer).

Those are standard/beta formats, not renewal-exam claims. Versioned exam guides in the registry govern coverage; the sample sizes above do not imply shortened exams or omitted objectives.

## Original authoring style

### Founder policy, rules v3: S1–S10 and O1–O5

Apply these rules to new generated candidates. Do not rewrite legacy bank rows
or infer exam frequencies from them.

| Rule | Contract |
| --- | --- |
| S1 — Purpose first | Name the business application or a concrete ML task in the opening, not an abstract model deployment. Use a natural human/organizational subject from S10; the planner records its prefix-family hint as `opening_style`. Hints never expand exam scope. |
| S2 — Facts as story | Describe what exists and what happened in plain narrative. Use a numbered list only for existing workflow steps, never requirements. |
| S3 — Constraints as wants or policies | At most two explicit wants or policies. Do not pack extra wants into one sentence or pre-exclude a distractor with “without X” or an equivalent approach-specific ban. Let product/ML knowledge eliminate alternatives. Never use “must satisfy the following requirements” or “Stakeholders have established”. |
| S4 — Natural task | Target about 70% “What should you do?” per batch. Rotate natural variants for the rest, with `question_line` recorded by the planner. Use a variant only when it fits the decision; do not invent a first-step premise. Every question line must end with “?” and must not name settings or config objects. |
| S5 — Reading size | Use 50–110 words and one paragraph, two at most. This is authoring policy, not a claim about all sample lengths. |
| S6 — Plain register | State goals in plain language. Use product names only as needed, with current short names such as Agent Platform Pipelines and Agent Platform Workbench. Use “Gemini Enterprise Agent Platform” at most once. Do not put setting names, enum values, file formats or code in the stem. |
| S7 — Objective-aware moment | At most half of a plan may be fresh design. For non-security objectives, rotate recent deployment, monitoring, migration, cost/latency reduction, scale growth and greenfield. Use a security incident only when the selected objective explicitly concerns security, privacy or governance. PMLE `6.1:x` and explicitly privacy-related data items are eligible. The planner records `scenario_moment` on every item and embeds the hint in its prompt. Start with an operational moment, so N=1 is not greenfield. The selected objective's actual decision must stay central; `scenario_relevant` fails when an incident wrapper displaces it. Hints never expand objective scope. |
| S8 — No documentation voice | Never put “documented”, “documentation”, “supported specifications” or “per best practices” in the stem. Evidence belongs in receipts, not learner prose. |
| S9 — No dated model names | No model/product version numbers unless the objective is explicitly version-specific. Prefer “a Gemini model”. |
| S10 — Human subject first | Begin with a human or organizational subject, then name the business application or concrete ML task required by S1. Plan approximately 30% “You are”, 25% “Your company/organization/team”, 10% “You work for”, 15% “You have/manage/use”, 10% “You need to”, and 10% “You recently”. These are batch targets, not exact single-item quotas. The narrow structural validator accepts only an opening `You` or `Your`, or `A`/`An`/`The` followed by an organization/person noun (including a qualified role such as “A machine learning engineer”). Reject service-first, abstract-model-first and task-only subjects; do not restore the old anywhere-in-stem keyword test. |
| O1 — Parallel actions | Write imperative, parallel practitioner actions of similar length. Use one or two sentences, or two or three short numbered steps. |
| O2 — Decisions, not syntax | Distinguish approach, service or sequence. Even for configuration-heavy objective 1.2:3, compare tuning/adaptation approaches and why they fit, not setting values or media resolution per image part. |
| O3 — Knowledge-dependent alternatives | A distractor may fail a stated want when the reason needs documented product/ML knowledge. The want itself is not disqualifying. Fail if a literal fact or prohibition excludes it, such as batch for an explicit online endpoint, a policy-banned action, or prompt design when supervised-learning adaptation is required. A hand-written server can validly fail minimal maintenance when rejecting it requires knowing that custom prediction routines provide the server. Multiple distractors may fail the same want for different documented reasons; do not add a third want. The required `distractors_need_knowledge` check stays fail-closed. |
| O4 — Length balance | Balance comparable detail, not cloned sentences or repeated scaffolding. All four options are parallel and within about ±20% of their mean word count. Never make the key uniquely longest; vary the non-key longest option and do not always tie the key for longest. The validator rejects a uniquely longest key more than 2 words ahead, or any option outside inclusive 0.75–1.25× mean. Counts use whitespace-separated words. Artifact reports include ties in the primary key-is-longest rate, record unique-longest separately, and target ≤35%. A missed batch target is reported, not a new automatic batch rejection. |
| O5 — Distinct approaches | Compare genuinely different approaches, services or sequences. At most one pair may be minor variants of one approach. Do not clone the same action and change a small setting or noun. Mechanically reject an item when three or more options share at least eight leading words. Report `option_prefix_report` using the maximum leading-word prefix shared by any three options per item, with option labels stripped: batch median target ≤2 words; the share of items with a prefix ≥6 words must be ≤10%. These batch targets are reports, not new automatic batch rejections. The required `options_distinct_approaches` judge check rejects semantic clones even when the mechanical prefix threshold is not reached. |

Codex is the generator/citer choice for the founder's existing subscription, not
a quality exemption. The default independent judge uses the Claude subscription
CLI (`claude`, Anthropic); Codex is OpenAI. An explicit OpenRouter judge remains
a fallback. Known different-vendor families are required, and all evidence,
schema, style and judge gates still apply. Generation is never publication.

### Canonical rules-v3 judge contract

Use one canonical DSPy verdict everywhere: 15 required fields, consisting of
`verdict`, `score`, `reason` and these 12 exact boolean checks:
`correct_answer_accurate`, `distractors_incorrect`, `distractors_plausible`,
`distractors_need_knowledge`, `options_distinct_approaches`,
`explanations_accurate`, `scenario_relevant`, `scenario_clear`,
`evidence_supported`, `business_context`, `constraints_as_wants`, and
`decisions_not_syntax`. PASS requires `verdict: "PASS"`, score ≥0.8 and all 12
checks true. False, missing, mistyped, extra-field, malformed or UNCERTAIN
verdicts fail closed; a high score never compensates. Generation, export, the
Claude runner, ingestion and repair eligibility all use this exact contract.
Historical 13/14-field verdicts stay historical; never invent the new check or
use an old verdict as rules-v3 approval. Repairs require the current strict
15-field FAIL: only `distractors_need_knowledge`, `constraints_as_wants`,
`distractors_plausible`, `decisions_not_syntax`, `scenario_clear`, and
`options_distinct_approaches` may fail. All other checks must be true. Missing or
mistyped checks, including O5, block repair; a supported O5 failure is eligible
under the same one-attempt rules and requires a fresh independent judgment.

### Writer self-check before returning

For each distractor, verify that no literal stem fact or prohibition excludes its
approach. Identify the documented product/ML knowledge needed to reject it. Count
at most two distinct wants or policies, including extra goals packed into one
sentence. Remove any “without X” clause where X is a distractor's approach. Check
the human-subject opening, objective-aware moment and genuinely distinct option
approaches. Balance comparable detail without cloning sentences. Keep all factual,
evidence, option-length, and fail-closed checks unchanged.

### Stem and task

Write one decision around a clear objective. Supply only facts needed to decide: workload, present state, desired change, and hard constraints. Put the task at the end. Use common words and exact current product/role names. Do not pad with a company's story when it cannot affect the answer.

Observed short qualifier patterns include **“least privilege,” “minimize cost,” “minimal maintenance,” “Google-recommended practices,” “low latency,”** and **“high availability.”** For new stems, follow S8: state the actual goal or constraint, not a documentation or best-practice appeal. Samples across Cloud Engineer, Developer, Database, ML, Network, and Security demonstrate these constraints [S03], [S09], [S08], [S14], [S13], [S12]. A qualifier must do real work: explain which plausible alternatives fail it. Do not use a recommendation phrase as unsupported authority.

Observed lengths are calibration evidence, not a hard minimum or maximum for the exams. New generated candidates follow the founder's S5 range. Foundational stems can be short conceptual checks. Technical sample scenarios can need several facts; new authored stems still follow S3's two-want/policy limit. Longer stems can include lists, code, diagrams, or shared cases; do not impose one narrow word cap across every family. Image-only measurements are missing, not proof that image questions are short.

### Choices and distractors

Use parallel options with comparable detail and grammar. Four choices are common in these samples; five and six also occur. Selection count must be explicit in new multi-select items, and controls/data must agree with it. Do not reproduce the observed radio/choose-two mismatch.

Make distractors plausible and refutable from current official docs plus the stem:

- **Service mismatch:** a real product solves a nearby but different job. Foundational samples compare categories, products, and AI techniques [S01], [S02]. Avoid arbitrary unrelated services as filler.
- **Technically possible, constraint-poor:** a solution may work but needs extra infrastructure, manual steps, or maintenance when the stem requests a managed approach [S09], [S14], [S15]. State the actual reason it loses; do not falsely claim it is impossible.
- **Cost or scale mismatch:** a provisioned resource can meet functionality but poorly fit idle periods, bursty demand, retention/access patterns, or global scale [S05], [S09], [S08]. Ground price/behavior claims in docs; do not invent exact costs.
- **Availability or latency mismatch:** the wrong region, replica choice, failure domain, polling cadence, or deployment strategy misses the stated requirement [S08], [S11], [S13]. Do not treat availability, durability, consistency, and latency as interchangeable.
- **Privilege or scope mismatch:** the right role at the wrong scope, broader access than needed, or individual grants instead of managed groups can violate constraints [S03], [S04], [S12]. Do not assume every scenario has the same identity pattern.
- **Wrong mechanism or sequence:** a familiar setting does not address the actual network, logging, agent-governance, evaluation, or incident-response failure [S06], [S13], [S15]. Prefer one diagnosis supported by the evidence over a bag of unrelated fixes.

These are qualitative observations, not measured distractor frequencies. Public answer-key access was not needed and no official sample option is reused. Each original distractor needs an independent rejection rationale. An item fails review if two choices still satisfy every constraint.

### Family-specific emphasis

- **Cloud Digital Leader:** business value, governance, basic service fit, security concepts, and cost models. The observed 15 recall and 14 scenario items support both concise concept checks and light business scenarios [S01]. Avoid turning every item into command syntax or implementation detail.
- **Generative AI Leader:** business use, model/tool fit, grounding, hallucinations, responsible adoption, and concept identification through examples. It has 20 scenario and five recall items here, with longer narratives than Digital Leader; “foundational” does not mean every stem is a one-line definition [S02].
- **Associate Cloud Engineer:** operational setup, access, billing, migration, deployment, and troubleshooting under clear requirements [S03]. **Workspace Administrator:** organizational units, sharing, mail, user lifecycle, Vault, and admin-policy scope [S04]. **Data Practitioner:** ingestion, transformation, storage lifecycle, BigQuery/Looker access, and pipeline operations [S05]. All 66 observed associate text items are scenarios; that observation does not forbid original recall items justified by an objective.
- **Professional core:** architecture, development, data, databases, DevOps, networking, and security samples emphasize constraint-sensitive designs, failure diagnosis, and operational tradeoffs [S07]–[S13]. Do not raise difficulty merely by adding irrelevant facts or obscure names.
- **ML and agentic AI:** distinguish current ML production workflows from agent orchestration, evaluation, tools, and governance. The current ML sample uses revised platform terminology; the [ML guide](https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf) is dated June 1, 2026. The Agentic Architect beta has its [own guide](https://services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf). Check current docs before using names from either sample [S14], [S06].
- **Security versus Security Operations:** Cloud Security includes IAM/scope, network protections, encryption, and compliance decisions [S12]. Security Operations' six samples focus on SecOps ingestion, detection, investigation, and SOAR workflows [S15]. Do not substitute general cloud-security recall for incident-response objectives or infer broad coverage from six examples.

## Exam-dump cross-check (reference only, founder policy D-024)

On 2026-10-04 an agent viewed only the free first page of one public dump site for PMLE and Associate Cloud Engineer, and stopped at the login wall. No question text, options or answers were stored, prompted or used as an answer key. Only these aggregate notes were kept:

- **PMLE:** 10 items, all 4 options, none choose-N. Stems were ~30–120 words, typically 60–80. Every product name used pre-Vertex branding ("AI Platform", AutoML Tables, Kubeflow), so these items predate the June 2026 guide by years.
- **Associate Cloud Engineer:** 10 items, all 4 options, none choose-N. Stems were ~25–65 words, typically 40–50. 9 of 10 were scenarios, mostly Compute Engine, IAM and console or gcloud tasks.
- **Verdict:** the format matches the official samples above, and the topics are stale against the current guides. Dumps add no signal the official sources don't already give, so the process does not depend on them.

### Rules-v3 calibration, 2026-10-05 (founder-supplied aggregates)

The founder measured 200 official professional text questions: about 30% opened
with “You are”, 25% with “Your company/organization/team”, 11% with
“You have/manage/used”, 8.5% with “You need/want to”, and 3% with “You recently”.
About 4% used a third-person organization/person opening. No imperative or gerund
openings were observed. Leading words shared by at least three options, labels
stripped: median 0, 90th percentile 5, 95th percentile 7; only 7/200 had at least 8.
The S10 planned mix is authoring policy, not an exact reproduction of these rates.

A 19-item public-page review under D-024 found 100% You/Your openings, no items
with at least 8 shared leading words, and about 26% with one minor-variant pair.
Our 12 accepted round-4 items had median 7 shared words and 4/12 with at least 8.
These aggregates explain S10 and O5; no dump/sample items, options or keys were
stored or prompted. No network calls were made for this rules update.

### Historical rules-v2 calibration, 2026-10-05

The founder supplied a structural review of public pre-rebrand dump pages under
D-024. About 63% of openings used business scenarios and 37% began with a concrete
ML task. About 42% used the default task question, compared with the reported
72–88% in official samples and 100% in our round 3. This supports a roughly
one-third task-first mix and a 70% default-question target, not a live-exam frequency
claim. In the same review, 6 of 19 marked keys were longest (about 32%), and stems
had about 1.5 constraints; those aggregates support rules-v2 O4 and S3.

These are founder-reported reference-only aggregates, not answer evidence or a
representative exam study. No item text is retained or fed to generation. This
calibration update made no network requests and did not inspect or trust dump
answers. Product documentation remains the only factual authority.

## Case studies: shared context changes reading cost

The Architect public sample links ten items to four cases: **EHR Healthcare (4), Mountkirk Games (4), Helicopter Racing League (1), TerramEarth (1)** [S07]. EHR includes the image-only item. The other nine items have no such explicit case-reference page. The stem ranges exclude external case summaries and repeated reference instructions.

Sample-linked case sources (names and links only):

- [EHR Healthcare](https://services.google.com/fh/files/blogs/master_case_study_ehr_healthcare.pdf)
- [Mountkirk Games](https://services.google.com/fh/files/blogs/master_case_study_mountkirk_games.pdf)
- [Helicopter Racing League](https://services.google.com/fh/files/blogs/master_case_study_helicopter_racing_league.pdf)
- [TerramEarth](https://services.google.com/fh/files/blogs/master_case_study_terramearth.pdf)

**Important version mismatch:** the current [Architect standard guide](https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf) names [Altostrat Media](https://services.google.com/fh/files/misc/v6.1_pca_altostrat_media_case_study_english.pdf), [Cymbal Retail](https://services.google.com/fh/files/misc/v6.1_pca_cymbal_retail_case_study_english.pdf), [EHR Healthcare](https://services.google.com/fh/files/misc/v6.1_pca_ehr_healthcare_case_study_english.pdf), and [KnightMotives Automotive](https://services.google.com/fh/files/misc/v6.1_pca_knightmotives_automotive_case_study_english.pdf). These case URLs were extracted offline from the current standard guide; the case PDFs themselves were not fetched in this study. The [renewal guide](https://services.google.com/fh/files/misc/professional_cloud_architect_renewal_exam_guide_eng.pdf) names **Cymbal Retail and Altostrat Media**. Do not treat the old sample case list as the current exam case list. The [current certification page](https://cloud.google.com/certification/cloud-architect) states two case studies per standard exam; renewal has one and its own coverage rules.

For original case-based material, keep a separate context record with its own sources and version. Reuse it across linked items instead of repeating its full summary. Measure context words once, individual stem words separately, and total reading burden separately. First-use reading time is higher than later-item time; this study measured no completion times. Use original context, not copied case prose. If a question requires information missing from its context, repair or reject it.

## Official sample URLs (all available on 2026-10-04)

The table links below cite each measured public form. Tracking aliases do not represent extra samples.

- [Cloud Digital Leader official sample][S01]
- [Generative AI Leader official sample][S02]
- [Associate Cloud Engineer official sample][S03]
- [Associate Google Workspace Administrator official sample][S04]
- [Associate Data Practitioner official sample][S05]
- [Professional Agentic Architect (Beta) official sample][S06]
- [Professional Cloud Architect official sample][S07]
- [Professional Cloud Database Engineer official sample][S08]
- [Professional Cloud Developer official sample][S09]
- [Professional Data Engineer official sample][S10]
- [Professional Cloud DevOps Engineer official sample][S11]
- [Professional Cloud Security Engineer official sample][S12]
- [Professional Cloud Network Engineer official sample][S13]
- [Professional Machine Learning Engineer official sample][S14]
- [Professional Security Operations Engineer official sample][S15]

[S01]: https://docs.google.com/forms/d/e/1FAIpQLSedAmf77MGS7FGEaylFzY51KtBd7kkIZJIMDsV5zSRSmpKIOA/viewform
[S02]: https://docs.google.com/forms/d/e/1FAIpQLScNn5oUIFeMQjtsHilQsJPxDsnP-0DbhDVsIXaBeCmPj-dgYw/viewform?usp=send_form
[S03]: https://docs.google.com/forms/d/e/1FAIpQLSfexWKtXT2OSFJ-obA4iT3GmzgiOCGvjrT9OfxilWC1yPtmfQ/viewform
[S04]: https://docs.google.com/forms/d/e/1FAIpQLScxMo77NjigN7bs3rKhXFRBvrjf5TqdaIzAw39g-MCLMvaSHQ/viewform?usp=send_form
[S05]: https://docs.google.com/forms/d/e/1FAIpQLScnT9BGAkP_XzaGCtpUqKktIXhr65VkeJrxEL4jT3cMvwYZmw/viewform?resourcekey=0-xKV2_Z4rEIoOmLOAi8LlAA
[S06]: https://docs.google.com/forms/d/1fi1gqbWsNCFxm1CT9V-JNGff1lyqfU9kNWAaaQMvRi4/viewform?edit_requested=true
[S07]: https://docs.google.com/forms/d/e/1FAIpQLSf54f7FbtSJcXUY6-DUHfBG31jZ3pujgb8-a5io_9biJsNpqg/viewform?usp=sf_link
[S08]: https://docs.google.com/forms/d/e/1FAIpQLSe55cAg8a3NzgV_QCJ2_F75NAyE44Z-XuVB6oPJXaWnI5UBIQ/viewform
[S09]: https://docs.google.com/forms/d/e/1FAIpQLSfFeB8zBNi2q-ar0V7iIguhk2e6P-UkrJ8OJfg6n0k6HcYLDQ/viewform
[S10]: https://docs.google.com/forms/d/e/1FAIpQLSfkWEzBCP0wQ09ZuFm7G2_4qtkYbfmk_0getojdnPdCYmq37Q/viewform
[S11]: https://docs.google.com/forms/d/e/1FAIpQLSdpk564uiDvdnqqyPoVjgpBp0TEtgScSFuDV7YQvRSumwUyoQ/viewform
[S12]: https://docs.google.com/forms/d/e/1FAIpQLSfSuKEE8cUQWj9sfak7QG9hpaljBC89Y22KoWMQFgoECZjzUg/viewform
[S13]: https://docs.google.com/forms/d/e/1FAIpQLServ0tNGkr-dYAfmez_Gdk74dmVypZjzUKrkVFtFcArzhmPow/viewform
[S14]: https://docs.google.com/forms/d/e/1FAIpQLSeYmkCANE81qSBqLW0g2X7RoskBX9yGYQu-m1TtsjMvHabGqg/viewform
[S15]: https://docs.google.com/forms/d/e/1FAIpQLScryxTOcaqWaPwxsQ-yjq29xRpYGpsAdy9L0XtIXtZy0s3miQ/viewform

Discovery links for redirected forms: [Generative AI shortlink](https://forms.gle/soztS7Q74AXBncATA), [Workspace shortlink](https://forms.gle/neC5XLotJGvRBgEz9), [Agentic Architect preview](https://docs.google.com/forms/d/1fi1gqbWsNCFxm1CT9V-JNGff1lyqfU9kNWAaaQMvRi4/preview). All were linked directly from the official certification pages.
