# Certification article fact check — 2026-10-16

Checked October 16, 2026 against the local certification registry and directly fetched official Google pages/PDFs. All ten articles are new sources; preserved historical blog blobs remain unchanged. Standard exam variants only in ACE/PCA/PDE guides.

## Evidence boundaries

- A guide’s as-of date is not an exam cutover date. Both PMLE PDF URLs now serve the current outline. Earlier subsection placements and weights cannot be independently verified from current live URLs, so no specific former placements or weight deltas are published.
- Study scenarios, artifacts, role choices and recommendations are original editorial exercises, not factual descriptions of actual exam items or outcome predictions. No sample question text or answer keys are reproduced.
- Site facts (free PMLE diagnostic, non-PMLE notification CTAs, PMLE-only practice) come from the app and D-036, not Google. Publication dates are October 16, 2026 for this editorial release; they are not exam revision dates.
- All numeric exam facts in the three non-PMLE guides use the standard exam, never a renewal exam. Tax qualifications and approximate weights are retained.
- All 15 certification links are intentional in the comparison article; the other articles have 3–5 internal links. No tool routes are added. The certification path article links to `/tools/which-google-cloud-certification` with explicit approval; the picker route ships separately in PR #243.

## Article inventory

Counts use whitespace-separated Markdown body tokens, excluding frontmatter. They include headings, tables and link markup; these are reproducible editorial counts, not estimates of rendered prose.

| Title | Route | Body words |
| --- | --- | ---: |
| PMLE exam changes: June 2026 guide explained | `/blog/pmle-exam-changes-june-2026` | 1239 |
| PMLE exam domains and weights explained (2026) | `/blog/pmle-exam-domains-weights` | 1500 |
| Vertex AI to Agent Platform: PMLE Name Mapping | `/blog/vertex-ai-agent-platform-name-mapping` | 1304 |
| PMLE Exam Format, Cost, and Languages in 2026 | `/blog/pmle-exam-format-cost-languages-2026` | 724 |
| PMLE Passing Score: What Google Actually Reports | `/blog/pmle-passing-score` | 590 |
| PMLE study plan by domain: use your diagnostic results | `/blog/pmle-study-plan-by-domain` | 1550 |
| Associate Cloud Engineer exam guide (2026) | `/blog/ace-exam-guide-2026` | 1071 |
| Professional Cloud Architect exam guide (2026) | `/blog/pca-exam-guide-2026` | 1168 |
| Professional Data Engineer exam guide (2026) | `/blog/pde-exam-guide-2026` | 1249 |
| Google Cloud certification path: all 15 certs compared | `/blog/google-cloud-certification-path` | 1675 |

## Claim → official source

| Article(s) | Claim | Official URL | Evidence / qualification |
| --- | --- | --- | --- |
| PMLE changes / domains / study plan | Guide explicitly marked as of June 1, 2026; not a separately stated exam effective date | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Fetched PDF header; guide record as_of_date, effective_date=null |
| PMLE changes / domains / study plan | Section 1: Architecting low-code AI solutions; approximately 13% | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Registry guides[0].sections[0]; fetched current PDF |
| PMLE changes / domains / study plan | Section 2: Collaborating within and across teams to manage data and models; approximately 16% | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Registry guides[0].sections[1]; fetched current PDF |
| PMLE changes / domains / study plan | Section 3: Scaling prototypes into ML models; approximately 21% | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Registry guides[0].sections[2]; fetched current PDF |
| PMLE changes / domains / study plan | Section 4: Serving and scaling models; approximately 20% | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Registry guides[0].sections[3]; fetched current PDF |
| PMLE changes / domains / study plan | Section 5: Automating and orchestrating ML pipelines; approximately 18% | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Registry guides[0].sections[4]; fetched current PDF |
| PMLE changes / domains / study plan | Section 6: Monitoring AI solutions; approximately 13% | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Registry guides[0].sections[5]; fetched current PDF |
| PMLE changes / domains / study plan | Published approximate weights total 101%; not an exact question allocation | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Arithmetic: 13+16+21+20+18+13=101 |
| PMLE changes / domains / study plan | BigQuery ML and Agent Platform AutoML; training AutoML; fine-tuning Gemini using BigQuery | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 1.1; registry matching subsection |
| PMLE changes / domains / study plan | Model Garden model selection; Document AI, Vision, Translate examples; Gemini/Imagen/Veo tuning; Gemini cost/latency/availability | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 1.2; registry matching subsection |
| PMLE changes / domains / study plan | Preprocessing tool selection by scale and complexity: SQL/BigQuery, Dataflow, Apache Spark, in-memory Python; features and privacy | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 2.1; registry matching subsection |
| PMLE changes / domains / study plan | Workbench / Colab Enterprise notebooks; collaboration/security; PyTorch, sklearn, JAX examples | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 2.2; registry matching subsection |
| PMLE changes / domains / study plan | Predictive and generative evaluation including LLM-as-a-judge; artifact/version/lineage tracking | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 2.3; registry matching subsection |
| PMLE changes / domains / study plan | Model type, product and deployment selection under cost/complexity/latency/scale; ARIMA/DNN/LLM and interpretability | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 3.1; registry matching subsection |
| PMLE changes / domains / study plan | Training organization, SDKs, troubleshooting, hyperparameter tuning and when to tune foundation models | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 3.2; registry matching subsection |
| PMLE changes / domains / study plan | CPU/GPU/TPU choices; distributed training with data/model parallelism | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 3.3; registry matching subsection |
| PMLE changes / domains / study plan | Batch/online serving; containers; Model Registry; A/B and canary; inference pre/postprocessing | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 4.1; registry matching subsection |
| PMLE changes / domains / study plan | Features, public/private endpoints, hardware and throughput-based scaling | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 4.2; registry matching subsection |
| PMLE changes / domains / study plan | Validation; orchestration examples Pipelines, Managed Service for Apache Airflow, Ray; training-serving consistency | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 5.1; registry matching subsection |
| PMLE changes / domains / study plan | Retraining policy; continuous integration/delivery/training (CI/CD/CT) | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 5.2; registry matching subsection |
| PMLE changes / domains / study plan | Data exfiltration, malicious prompting, sensitive information with LLMs; Regex/safety filters/Model Armor; responsible AI and explainability | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 6.1; registry matching subsection |
| PMLE changes / domains / study plan | Continuous model evaluation; training-serving skew, data/concept/feature-attribution drift; generative monitoring/testing/evaluation | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf | Guide section 6.2; registry matching subsection |
| PMLE changes | Exam updated for Vertex AI to Gemini Enterprise Agent Platform, analytics stack and Google Cloud native emphasis | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched certification announcements |
| PMLE changes | Exam does not directly assess coding skills; minimum Python/SQL proficiency for snippets | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched role-note paragraph; also guide introduction |
| PMLE changes | The old unversioned guide URL now serves the same section titles/weights as current URL | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english.pdf | Fetched both PDFs on 2026-10-16; old PDF lacks new as-of header. This is a current observation, not archive proof. |
| PMLE changes | Previous subsection placements and former weights not independently verifiable from live official URLs; omitted | https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english.pdf | Both live PDFs now serve current content. PMLE-DRIFT.md consulted but not treated as official proof of a prior blueprint. |
| PMLE logistics / study / comparison | Two-hour standard exam | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched About this certification exam; registry standard variant / recommended_experience |
| PMLE logistics / study / comparison | 50–60 multiple-choice and multiple-select questions | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched About this certification exam; registry standard variant / recommended_experience |
| PMLE logistics / study / comparison | $200 plus tax where applicable | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched About this certification exam; registry standard variant / recommended_experience |
| PMLE logistics / study / comparison | English and Japanese | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched About this certification exam; registry standard variant / recommended_experience |
| PMLE logistics / study / comparison | Remote online-proctored or onsite-proctored testing center | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched About this certification exam; registry standard variant / recommended_experience |
| PMLE logistics / study / comparison | No prerequisites (does not waive general exam policies) | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched About this certification exam; registry standard variant / recommended_experience |
| PMLE logistics / study / comparison | Recommended 3+ years industry including 1+ years designing/managing Google Cloud solutions | https://cloud.google.com/learn/certification/machine-learning-engineer | Fetched About this certification exam; registry standard variant / recommended_experience |
| PMLE passing score | Google provides pass/fail results, not numerical scores; minimum passing standard | https://support.google.com/cloud-certification/answer/9438208?hl=en | Why don’t I receive my score? paragraph, fetched logistics-faq.txt |
| PMLE passing score | Pass based on entire exam, not passing each section separately; unsuccessful candidates get section feedback in Candidate Portal Exam History | https://support.google.com/cloud-certification/answer/9438208?hl=en | Will I receive section-level feedback? paragraph. Not available for beta/renewal exams; article standard context. |
| PMLE passing score | No passing number published on checked PMLE page | https://cloud.google.com/learn/certification/machine-learning-engineer | Limited negative observation checked 2026-10-16, not claim about all Google publications |
| PMLE passing score | Official samples do not represent scope/difficulty; results not predictive | https://docs.google.com/forms/d/e/1FAIpQLSeYmkCANE81qSBqLW0g2X7RoskBX9yGYQu-m1TtsjMvHabGqg/viewform | Fetched public form; only warning quoted, no sample questions/answers reproduced |
| Name mapping | Vertex AI Platform → Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI API → Gemini Enterprise Agent Platform API | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Model Garden → Gemini Enterprise Agent Platform Model Garden | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Training → Gemini Enterprise Agent Platform Managed Training | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Serverless Training → Gemini Enterprise Agent Platform Serverless Training | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Pipelines → Gemini Enterprise Agent Platform Pipelines | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Workbench → Gemini Enterprise Agent Platform Workbench | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Feature Store → Feature Store on Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Model Registry → Model Registry on Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Model Evaluation → Model Evaluation on Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Experiments → Experiments on Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Model Monitoring → Model Monitoring on Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI AutoML (Vision/Video/Tables) → AutoML on Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Batch Inference → Gemini Enterprise Agent Platform Batch Inference | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Online Inference → Gemini Enterprise Agent Platform Online Inference | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Agent Engine → Agent Runtime on Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Vector Search → Vector Search on Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | Vertex AI Vector Search 2.0 → Agent Retrieval on Gemini Enterprise Agent Platform | https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes | Exact official name-change table row, mapping-name-changes.json HTTP 200 |
| Name mapping | API service remains aiplatform.googleapis.com | https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest | Fetched mapping-api.json |
| Name mapping | Current Python instructions retain google-cloud-aiplatform, google.cloud.aiplatform and vertexai.preview | https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/python-sdk/use-python-sdk | Fetched mapping-sdk.json; present instructions, not indefinite support promise |
| Name mapping | Two tested old doc URLs redirect to current machine-learning and REST paths | https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning | See mapping-factcheck.md; redirects only for tested URLs, not universal claim |
| ace-exam-guide-2026 | duration_stated: 2 hours | https://cloud.google.com/learn/certification/cloud-engineer | Fetched standard exam page; not renewal variant |
| ace-exam-guide-2026 | format_stated: 50-60 multiple choice and multiple select questions | https://cloud.google.com/learn/certification/cloud-engineer | Fetched standard exam page; not renewal variant |
| ace-exam-guide-2026 | price_stated: $125 (plus tax where applicable) | https://cloud.google.com/learn/certification/cloud-engineer | Fetched standard exam page; not renewal variant |
| ace-exam-guide-2026 | languages_stated: English, Japanese, Spanish, Portuguese | https://cloud.google.com/learn/certification/cloud-engineer | Fetched standard exam page; not renewal variant |
| ace-exam-guide-2026 | delivery_stated: a. Take the Online-proctored exam from a remote location. b. Take the onsite-proctored exam at a testing center - search for Google Cloud. | https://cloud.google.com/learn/certification/cloud-engineer | Fetched standard exam page; not renewal variant |
| ace-exam-guide-2026 | validity_stated: 3 years | https://cloud.google.com/learn/certification/cloud-engineer | Fetched standard exam page; not renewal variant |
| ace-exam-guide-2026 | No prerequisites; recommended experience: 6+ months hands on experience with Google Cloud | https://cloud.google.com/learn/certification/cloud-engineer | Fetched prerequisites / experience |
| ace-exam-guide-2026 | Section 1: Setting up a cloud solution environment, approximately 20%; section scope paraphrased in article | https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| ace-exam-guide-2026 | Section 2: Planning and implementing a cloud solution, approximately 30%; section scope paraphrased in article | https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| ace-exam-guide-2026 | Section 3: Ensuring the successful operation of a cloud solution, approximately 30%; section scope paraphrased in article | https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| ace-exam-guide-2026 | Section 4: Configuring access and security, approximately 20%; section scope paraphrased in article | https://services.google.com/fh/files/misc/associate_cloud_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pca-exam-guide-2026 | duration_stated: 2 hours | https://cloud.google.com/learn/certification/cloud-architect | Fetched standard exam page; not renewal variant |
| pca-exam-guide-2026 | format_stated: 50-60 multiple choice and multiple select questions | https://cloud.google.com/learn/certification/cloud-architect | Fetched standard exam page; not renewal variant |
| pca-exam-guide-2026 | price_stated: $200 (plus tax where applicable) | https://cloud.google.com/learn/certification/cloud-architect | Fetched standard exam page; not renewal variant |
| pca-exam-guide-2026 | languages_stated: English, Japanese | https://cloud.google.com/learn/certification/cloud-architect | Fetched standard exam page; not renewal variant |
| pca-exam-guide-2026 | delivery_stated: a. Take the online-proctored exam from a remote location. b. Take the onsite-proctored exam at a testing center - search for Google Cloud. | https://cloud.google.com/learn/certification/cloud-architect | Fetched standard exam page; not renewal variant |
| pca-exam-guide-2026 | validity_stated: 2 years | https://cloud.google.com/learn/certification/cloud-architect | Fetched standard exam page; not renewal variant |
| pca-exam-guide-2026 | case_studies_stated: Each exam includes 2 case studies. Case study questions make up 20-30% of the exam and assess your ability to apply your knowledge to a realistic business situation. You can view the case studies on a split screen during the exam. See the standard Exam Guide for the 4 available case studies. | https://cloud.google.com/learn/certification/cloud-architect | Fetched standard exam page; not renewal variant |
| pca-exam-guide-2026 | No prerequisites; recommended experience: 3+ years of industry experience including 1+ years designing and managing solutions using Google Cloud | https://cloud.google.com/learn/certification/cloud-architect | Fetched prerequisites / experience |
| pca-exam-guide-2026 | Section 1: Designing and planning a cloud solution architecture, approximately 25%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pca-exam-guide-2026 | Section 2: Managing and provisioning a cloud solution infrastructure, approximately 17.5%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pca-exam-guide-2026 | Section 3: Designing for security and compliance, approximately 17.5%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pca-exam-guide-2026 | Section 4: Analyzing and optimizing technical and business processes, approximately 15%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pca-exam-guide-2026 | Section 5: Managing implementation, approximately 12.5%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pca-exam-guide-2026 | Section 6: Ensuring solution and operations excellence, approximately 12.5%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pca-exam-guide-2026 | Two case studies; 20–30% of standard exam; split-screen availability | https://cloud.google.com/learn/certification/cloud-architect | Fetched standard case-study paragraph, no renewal facts blended |
| pca-exam-guide-2026 | Altostrat Media, Cymbal Retail, EHR Healthcare, KnightMotives Automotive; six Well-Architected pillars | https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf | Fetched standard guide |
| pde-exam-guide-2026 | duration_stated: 2 hours | https://cloud.google.com/learn/certification/data-engineer | Fetched standard exam page; not renewal variant |
| pde-exam-guide-2026 | format_stated: 40-50 multiple choice and multiple select questions | https://cloud.google.com/learn/certification/data-engineer | Fetched standard exam page; not renewal variant |
| pde-exam-guide-2026 | price_stated: $200 (plus tax where applicable) | https://cloud.google.com/learn/certification/data-engineer | Fetched standard exam page; not renewal variant |
| pde-exam-guide-2026 | languages_stated: English, Japanese | https://cloud.google.com/learn/certification/data-engineer | Fetched standard exam page; not renewal variant |
| pde-exam-guide-2026 | delivery_stated: a. Take the online-proctored exam from a remote location. b. Take the onsite-proctored exam at a testing center - search for Google Cloud. | https://cloud.google.com/learn/certification/data-engineer | Fetched standard exam page; not renewal variant |
| pde-exam-guide-2026 | validity_stated: 2 years | https://cloud.google.com/learn/certification/data-engineer | Fetched standard exam page; not renewal variant |
| pde-exam-guide-2026 | No prerequisites; recommended experience: 3+ years of industry experience including 1+ years designing and managing solutions using Google Cloud. | https://cloud.google.com/learn/certification/data-engineer | Fetched prerequisites / experience |
| pde-exam-guide-2026 | Section 1: Designing data processing systems, approximately 22%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_data_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pde-exam-guide-2026 | Section 2: Ingesting and processing the data, approximately 25%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_data_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pde-exam-guide-2026 | Section 3: Storing the data, approximately 20%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_data_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pde-exam-guide-2026 | Section 4: Preparing and using data for analysis, approximately 15%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_data_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| pde-exam-guide-2026 | Section 5: Maintaining and automating data workloads, approximately 18%; section scope paraphrased in article | https://services.google.com/fh/files/misc/professional_data_engineer_exam_guide_english.pdf | Fetched standard guide; registry matching section/subsections/objectives |
| Certification comparison | Professional Agentic Architect; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of hands-on experience building, testing, deploying, and managing cloud solutions including 1+ years building agentic solutions using Google Cloud | https://cloud.google.com/learn/certification/agentic-architect/ | registry.json level / agentic-architect.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Associate Google Workspace Administrator; associate; role-fit paraphrase; prerequisites none; experience: 6 months of Google Workspace Super Admin experience in a real or test environment. Hands-on experience with Business Plus edition and knowledge of Enterprise Edition features and functionality. | https://cloud.google.com/learn/certification/associate-google-workspace-administrator | registry.json level / associate-google-workspace-administrator.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Cloud Architect; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of industry experience including 1+ years designing and managing solutions using Google Cloud | https://cloud.google.com/learn/certification/cloud-architect | registry.json level / cloud-architect.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Cloud Database Engineer; professional; role-fit paraphrase; prerequisites none; experience: 5+ years of overall database and IT experience, including 2 years of hands-on experience working with Google Cloud database solutions | https://cloud.google.com/learn/certification/cloud-database-engineer | registry.json level / cloud-database-engineer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Cloud Developer; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of industry experience including 1+ years designing and managing solutions using Google Cloud. | https://cloud.google.com/learn/certification/cloud-developer | registry.json level / cloud-developer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Cloud DevOps Engineer; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of industry experience including 1+ years designing and managing production systems using Google Cloud | https://cloud.google.com/learn/certification/cloud-devops-engineer | registry.json level / cloud-devops-engineer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Cloud Digital Leader; foundational; role-fit paraphrase; prerequisites none; experience: Experience collaborating with technical professionals | https://cloud.google.com/learn/certification/cloud-digital-leader | registry.json level / cloud-digital-leader.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Associate Cloud Engineer; associate; role-fit paraphrase; prerequisites none; experience: 6+ months hands on experience with Google Cloud | https://cloud.google.com/learn/certification/cloud-engineer | registry.json level / cloud-engineer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Cloud Network Engineer; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of industry experience including 1+ years designing and managing solutions using Google Cloud | https://cloud.google.com/learn/certification/cloud-network-engineer | registry.json level / cloud-network-engineer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Cloud Security Engineer; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of industry experience including more than 1 year designing and managing solutions using Google Cloud | https://cloud.google.com/learn/certification/cloud-security-engineer | registry.json level / cloud-security-engineer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Data Engineer; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of industry experience including 1+ years designing and managing solutions using Google Cloud. | https://cloud.google.com/learn/certification/data-engineer | registry.json level / data-engineer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Associate Data Practitioner; associate; role-fit paraphrase; prerequisites none; experience: 6+ months of experience working with data on Google Cloud. | https://cloud.google.com/learn/certification/data-practitioner | registry.json level / data-practitioner.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Generative AI Leader; foundational; role-fit paraphrase; prerequisites none; experience: Not stated | https://cloud.google.com/learn/certification/generative-ai-leader | registry.json level / generative-ai-leader.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Machine Learning Engineer; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of industry experience including 1 or more years designing and managing solutions using Google Cloud. | https://cloud.google.com/learn/certification/machine-learning-engineer | registry.json level / machine-learning-engineer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | Professional Security Operations Engineer; professional; role-fit paraphrase; prerequisites none; experience: 3+ years of security industry experience including 1+ years using Google Cloud security tooling | https://cloud.google.com/learn/certification/security-operations-engineer | registry.json level / security-operations-engineer.json; chooser-<id>.txt HTTP 200 for role/prerequisite/experience |
| Certification comparison | 15 registry entries across foundational, associate and professional levels | https://cloud.google.com/learn/certification | Registry count, not a claim about every Google credential |
| Certification comparison | Agentic Architect closed-beta/upcoming GA; “GA registration opens Nov 2” distinct from “GA exam will launch in mid-November”; neither short statement gives year | https://cloud.google.com/learn/certification/agentic-architect/ | Fetched chooser-agentic-architect.txt; no inferred full-date launch promise |

## Fetch integrity receipts

Fetched evidence is retained in the worker research folder, not served by the site. The table below records downloaded-byte SHA256 values so a source snapshot can be identified even if a live page changes. Failed 404 probes are not sources and are omitted. The claim table above is the publication review record.

| Evidence file | SHA256 |
| --- | --- |
| `ace-page.html` | `4af27ffa129bba6b2fb482faae859cf8500ac2f14a88f92a542ffac657c1d4fb` |
| `ace-standard-guide.pdf` | `cbbf311ddbfa1792d03d21e3036898bb5b895136024caf315e5c39d9cad1a202` |
| `chooser-agentic-architect.html` | `d9d1955a07d269965114db85c07d2eb8c63f80ae411e0cc176b03d5924100815` |
| `chooser-associate-google-workspace-administrator.html` | `27ad6ef4e0d9d802d9e966db1982ec23821d403278685efec6aa454ed4964b33` |
| `chooser-cloud-architect.html` | `819bc7ae500a8ff367866a3839f640850d2aa56c188494e3d99679c1c736e776` |
| `chooser-cloud-database-engineer.html` | `769f68592209493725673ec930e95411a5e6a4fa787c7340d6ed2227c5f21391` |
| `chooser-cloud-developer.html` | `bf13dcc926387c6a55dd02c8b41beb1af3459acbce6c246aa5bc1601c221b09c` |
| `chooser-cloud-devops-engineer.html` | `01d45ff540cef335a90584855b4926c1720f4f20ba9181306bfdecebb4b30f9e` |
| `chooser-cloud-digital-leader.html` | `8f1335739e87cb71c313d1b19f36f6f1159299f9d19b1c21d59cc4e3e2c06014` |
| `chooser-cloud-engineer.html` | `deab806158b57ef1d0165dfb64f027d30c0cd2f72b097c72152c43f54e996cdf` |
| `chooser-cloud-network-engineer.html` | `2fe7368a7d744384492d84247c2c30562880d09320654687e2bf8769e6e222f2` |
| `chooser-cloud-security-engineer.html` | `c07a28355b7e69de897ffbd80cc372ed47842ca3d8c9adc1b90ed6b629dfa610` |
| `chooser-data-engineer.html` | `9e6015969ceec32a03bb406aa55e0a82cd82521e68d1d0cd375e0ef9a2fedb8b` |
| `chooser-data-practitioner.html` | `7df05f754fe3a721574ca13cc62d8e9232be2da4208224ea35d0c10b47f06d57` |
| `chooser-fetch-manifest.json` | `7766daa85b9be1da04bafaade1b607d22b8b69a0aa29fa9c43db052b601fd1f5` |
| `chooser-generative-ai-leader.html` | `72f6e7af451f63c0b11510851ea9d2207a7adbb45dd6ff0e8d2820d07a76e48a` |
| `chooser-machine-learning-engineer.html` | `7eb7f6df680b76d201feb1da05ff36f5dac2c418c04c70220c923464c95c1728` |
| `chooser-security-operations-engineer.html` | `f75e0457c2683514e8a4ad849188367f372c3813b6060b38543388f4b4df45c9` |
| `logistics-extra-0.html` | `926d14e108a0cc0d8ccf62f345c2a408b049595b1da02cee0e0efb0ec3cc5177` |
| `logistics-extra-1.html` | `28ee8f2751f422da6dd9d7a65a9f1cea8f036a7c058a63dcdd21f3f8edfe5ada` |
| `logistics-extra-2.html` | `f69fcfe2171d203b97b5a8798440d95eface45abb1d402aa2c961d544140cd27` |
| `logistics-faq.html` | `079b14b64632d1116a58337c380615196939e2571ccafc0f2ae5b5d0650d1fc0` |
| `logistics-fetches.json` | `222d104baeff9421383b65600177c14962c075a843aa7727339b9343688ad536` |
| `logistics-pmle.html` | `d6911c06cccf6811113eb7584471a239738eaff9a024bf075b6f9e887016e0cd` |
| `logistics-support-index.html` | `ac0256e4eaa8b3f1c5004f3e1f2b0bb09c2fc363c72b7ec0eabfb64c7087b8b7` |
| `mapping-api.json` | `5789b3596300072c11868290e88533c7c294bf45b41150c8a3217c234940a699` |
| `mapping-current-guide.pdf` | `8353ed16bc4fcaebd6dab301f61bf2f86a3eaf341a199a1d6f38196745e4a598` |
| `mapping-doc-0.json` | `1e0f6a37b1fa9f91f0b7b6874905de4df8dff4b2d9fe17286578bb6db30c54cb` |
| `mapping-doc-1.json` | `a8c892977df53faca43e2ae33d49064e422ed86c2e19da8606662a7d0cdfc9db` |
| `mapping-name-changes.json` | `d60cac00480e3711531a25020a7780cb2c1806f69fc52bcff37e498e2cab5ecf` |
| `mapping-overview.json` | `faa2072d4c3d6fa4ec9f19534a90bafb571e67789e90887dd39270e7327e88f1` |
| `mapping-pmle.json` | `6f0915846f9ee5fcd39b8cddd4666af0a303635400c77f791e5d50a3353f85c4` |
| `mapping-sdk.json` | `2376daa979c3e37a1a6c473ce3a5503e64fd1ebfdcd528e5c18a089d5c7340fb` |
| `pca-page.html` | `53a6825e809096ddfdb5c1f2b5e7307dafccc95e69323bd587af8d1e0ed4841c` |
| `pca-standard-guide.pdf` | `3803bc093831cbfe270f56446c270d072c67bbe8ad8f34579027add56549211d` |
| `pde-page.html` | `d8d6b683f64d58ac4260a8e4b26a4118d84b8689b7aeb2530a37bd6b068805ae` |
| `pde-standard-guide.pdf` | `4332edc16a03eb1f9258926e77f38eef6ef15097822e5f56153fa04dec5d064b` |
| `pmle-guide.pdf` | `8353ed16bc4fcaebd6dab301f61bf2f86a3eaf341a199a1d6f38196745e4a598` |
| `pmle-page.html` | `a33f66e858eaeb5d5b2f192fb71f3b4ce556fbb040680f53f9d932e1e917827f` |
| `pmle-previous-guide.pdf` | `ef66f03908330c7c9ee0bea29ce5b6f481731c7b93295a1c6f3d726950c6385f` |

## Verification of the final publication sources

- Independent source review: all ten articles passed after unsupported historical subsection/order comparisons were removed; all 18 mapping rows checked against the official table.
- Clean environment (`env -i PATH="$PATH" HOME="$HOME" CI=true`): `npm test` passed 973 tests in 51 files; `npm run lint`, `npm run typecheck`, and `docker build -t testero-content-1016 .` exited 0.
- Final image: `sha256:ea3b73b4f44cde80d865da55f32e7106d146ab6c735e7fd601855d9745418986`. Local production container returned HTTP 200 for all ten articles. Verified each H1, description, canonical, BlogPosting headline/datePublished/dateModified, checked date, absence of historical notice, appropriate footer CTA and sitemap inclusion.
- New source bytes match their reviewed publication hashes. Existing historical source files and overlays are unchanged. No active redirect rules, tool routes or dependencies changed.
- Docker emitted the existing `SecretsUsedInArgOrEnv` warning for the placeholder `SUPABASE_SERVICE_ROLE_KEY` environment declaration. No credential was supplied to this build. This content task does not alter Docker configuration.
- These checks prove local production rendering, not deployment, Google indexing, live Stripe/cloud behavior or future exam availability.

## Redirect decision (not enabled)

D-031 requires founder approval. Commented proposals only: `/blog/pmle-october-2024-exam-changes` → `/blog/pmle-exam-changes-june-2026`; `/blog/accelerated-google-ml-certification-30-day-success-story-2025` → `/blog/pmle-study-plan-by-domain`. Existing legacy pages remain live. No like-for-like replacement for `/blog/5-hardest-pmle-questions` is proposed here.

## Certification path keyword separation revision

The unpublished comparison article now uses `/blog/google-cloud-certification-path` and the title “Google Cloud certification path: all 15 certs compared” (54 characters), with a 148-character description. Its opening and headings frame paths by level and role, not a personal-selection quiz. The prominent near-top link reads “Want a personal shortlist? Try the certification picker” and targets `/tools/which-google-cloud-certification` (approved cross-PR link to #243). Catalog, reviewed source hash, article inventory and sitemap regression use the new slug. No redirect was added.

After the revision, clean-env tests passed 973 tests/51 files; lint, typecheck and Docker build exited 0. All ten articles rendered successfully in the revised production image. The new path returned HTTP 200 with matching H1, description, canonical and BlogPosting; the old unpublished blog path returned 404 without a redirect and is absent from the sitemap. The new path is in the sitemap and the picker link renders with the requested label. The picker itself is provided by PR #243, not verified as a live route in this branch.
