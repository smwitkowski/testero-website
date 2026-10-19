-- Internal controlled vocabulary and atomic question-level tagging.
BEGIN;
CREATE TABLE public.question_taxonomy (
 dimension text NOT NULL CHECK (dimension ~ '^[a-z][a-z0-9_]*$'),
 value_key text NOT NULL CHECK (value_key ~ '^[a-z][a-z0-9_]*$'),
 label text NOT NULL CHECK (length(btrim(label)) > 0),
 definition text NOT NULL CHECK (length(btrim(definition)) > 0),
 -- Empty means shared across all supported certs. Use pipeline cert slugs.
 cert_scope text[] NOT NULL DEFAULT '{}',
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY (dimension, value_key),
 CHECK (array_position(cert_scope, NULL) IS NULL)
);
CREATE TABLE public.question_tags (
 question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
 dimension text NOT NULL,
 value_key text NOT NULL,
 source text NOT NULL CHECK (source IN ('backfill','generation')),
 confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (question_id, dimension, value_key),
 FOREIGN KEY (dimension,value_key) REFERENCES public.question_taxonomy(dimension,value_key)
);
CREATE INDEX question_tags_value_question_idx ON public.question_tags(dimension,value_key,question_id);
ALTER TABLE public.question_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_taxonomy, public.question_tags FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_taxonomy TO service_role;
GRANT SELECT ON public.question_tags TO service_role;
-- Complete authoritative set for ONE question, not a partial-dimension patch.
-- Backfill cannot supersede generation-owned tags. No per-source coexistence.
CREATE FUNCTION public.replace_question_tags(p_question_id uuid, p_source text, p_tags jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_exam text;
BEGIN
 IF p_source IS NULL OR p_source NOT IN ('backfill','generation') THEN
  RAISE EXCEPTION 'invalid tag source' USING ERRCODE='22023';
 END IF;
 IF p_tags IS NULL OR jsonb_typeof(p_tags) <> 'array' THEN
  RAISE EXCEPTION 'tags must be an array' USING ERRCODE='22023';
 END IF;
 SELECT CASE exam WHEN 'GCP_PM_ML_ENG' THEN 'machine-learning-engineer' ELSE exam END
 INTO v_exam FROM public.questions WHERE id=p_question_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown question' USING ERRCODE='23503'; END IF;
 IF p_source='backfill' AND EXISTS (
  SELECT 1 FROM public.question_tags WHERE question_id=p_question_id AND source='generation'
 ) THEN RAISE EXCEPTION 'generation owns question tags' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_tags) e WHERE jsonb_typeof(e) <> 'object'
  OR NOT (e ?& ARRAY['dimension','value_key','confidence'])
  OR (e - ARRAY['dimension','value_key','confidence']) <> '{}'::jsonb
  OR jsonb_typeof(e->'dimension') <> 'string'
  OR jsonb_typeof(e->'value_key') <> 'string'
  OR jsonb_typeof(e->'confidence') <> 'number') THEN
  RAISE EXCEPTION 'malformed tag' USING ERRCODE='22023';
 END IF;
 IF EXISTS (
  SELECT 1 FROM jsonb_to_recordset(p_tags) AS t(dimension text,value_key text,confidence numeric)
  LEFT JOIN public.question_taxonomy v USING (dimension,value_key)
  WHERE v.dimension IS NULL OR NOT v.active OR t.confidence NOT BETWEEN 0 AND 1
   OR NOT (cardinality(v.cert_scope)=0 OR v_exam=ANY(v.cert_scope))
 ) THEN RAISE EXCEPTION 'invalid, inactive or out-of-scope tag' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_tags) AS t(dimension text,value_key text)
  GROUP BY dimension,value_key HAVING count(*)>1) THEN
  RAISE EXCEPTION 'duplicate tag' USING ERRCODE='22023';
 END IF;
 -- Unchanged rows retain created_at: repeated payloads are true no-ops.
 DELETE FROM public.question_tags old WHERE old.question_id=p_question_id AND NOT EXISTS (
  SELECT 1 FROM jsonb_to_recordset(p_tags) AS t(dimension text,value_key text)
  WHERE t.dimension=old.dimension AND t.value_key=old.value_key
 );
 INSERT INTO public.question_tags(question_id,dimension,value_key,source,confidence)
 SELECT p_question_id,t.dimension,t.value_key,p_source,t.confidence
 FROM jsonb_to_recordset(p_tags) AS t(dimension text,value_key text,confidence numeric)
 ON CONFLICT (question_id,dimension,value_key) DO UPDATE
 SET source=excluded.source, confidence=excluded.confidence
 WHERE (question_tags.source,question_tags.confidence) IS DISTINCT FROM (excluded.source,excluded.confidence);
END;
$$;
REVOKE ALL ON FUNCTION public.replace_question_tags(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_question_tags(uuid,text,jsonb) TO service_role;
INSERT INTO public.question_taxonomy(dimension,value_key,label,definition,cert_scope) VALUES
('decision_type','select_solution','Select a solution','Choose the task, model family, managed API, or platform approach that fits the required outcome; exclude tuning an already-selected model or configuring its runtime.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','adapt_model','Adapt a foundation model','Choose prompting, grounding, supervised or parameter-efficient tuning, or tuning data representation to change a selected foundation model’s task behavior.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','prepare_data','Prepare and move data','Choose ingestion, transfer, batch/stream transformation, query/storage layout or dataset preservation; exclude online feature registry semantics and fitted training-serving state.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','manage_features','Manage shared features','Choose feature registration, discoverability, entity/event-time semantics, online views, synchronization or reuse across training and serving.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','preserve_preprocessing','Preserve preprocessing state','Keep fitted encoders, normalization, tokenizers and transformations consistent across training and inference; merely sharing code is not enough.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','validate_quality','Validate quality','Choose held-out populations, splits, comparison metrics, fairness slices or offline evaluation that make a quality claim or release gate meaningful; not ongoing telemetry setup.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','optimize_training','Optimize training','Choose a training objective/loss, search method, search space, regularization or trial strategy; exclude hardware sizing and foundation-model adaptation method.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','provision_compute','Provision workload compute','Choose hardware, parallelism, job packaging, checkpointing or resource shape for execution; exclude serving replica scaling and interactive notebook setup.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','package_inference','Package inference','Choose batch versus online execution, serving containers, request/response handlers, model loading or runtime routes; exclude traffic rollout and replica policy.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','scale_capacity','Scale serving capacity','Choose serving scaling signal, replicas, warm capacity, concurrency or capacity reservation to match demand.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','release_safely','Release safely','Choose rollout, rollback, traffic allocation or stable experiment cohorts across versions; not merely recording a version or gating a build.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','orchestrate_workflow','Orchestrate a workflow','Choose a workflow runner, component graph, dependency passing, reusable template or execution cache for a multi-step process.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','trigger_automation','Trigger lifecycle automation','Choose when to run retraining/builds/jobs or how approvals and event triggers start lifecycle actions; exclude component graph design and traffic rollout.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','track_provenance','Track versions and provenance','Choose model version grouping, mutable aliases, experiment records or artifact/execution lineage to reproduce, compare or trace results.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','monitor_behavior','Monitor behavior','Choose operational telemetry, drift/skew/output baselines, recurring quality/fairness checks, sampling or alerting for a running system; not one-time candidate validation.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','explain_predictions','Explain predictions','Choose local/global feature attribution, explanation baseline or interpretation method matching the requested explanatory scope.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','protect_information','Protect information','Choose de-identification, encryption, prompt/output screening or security-threat controls at the right data-flow boundary; access identities and private network setup belong to manage_access.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','manage_access','Manage access and boundaries','Choose identity, permission scope, hierarchy/policy placement or private network connectivity. Includes resource organization only when it determines control or ownership.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('decision_type','configure_environment','Configure a development environment','Choose interactive workspace, notebook sharing, language/dependency isolation or development-tool integration; exclude production training jobs.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','cost','Cost or work budget','Money, token/compute spend, repeated processing or bounded trials constrain the choice.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','operational_effort','Operational effort','Minimize owned code, servers, maintenance, manual coordination or required specialist skills. Do not infer this solely from the word managed.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','latency','Latency or deadline','An end-to-end response-time, cold-start or completion-time requirement discriminates alternatives.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','capacity','Capacity or scale','Demand, data volume, memory, throughput or concurrency changes feasibility; volume alone is not enough unless it affects the decision.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','reliability','Reliability or availability','Keep operations available, recover from interruption, avoid duplicate/lost work or support safe fallback.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','security_privacy','Security, privacy or residency','Protect confidentiality, least privilege, regulated data, location or an explicit trust boundary.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','compatibility','Compatibility or retained control','Preserve an existing framework, language, protocol, dependency, interface or required customization; existing alone is not sufficient.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','freshness','Freshness or event timing','Use sufficiently current data, event-time meaning, timely updates or correct label-maturity windows.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','data_integrity','Data or state consistency','Preserve schemas, entity joins, fitted representations or equivalent behavior across runs and environments.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','measurement_validity','Measurement validity','Use appropriate metric, reference population, holdout, causal cohort or subgroup evidence for the actual business question.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('constraint','traceability','Traceability or reproducibility','Recover exact cohorts, versions, artifacts or provenance to reproduce or audit a past result.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','wrong_capability','Wrong capability or abstraction','Alternative cannot perform the required task or chooses the wrong task/model/service interface.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','wrong_measurement','Wrong metric, scope or reference','Measures a proxy or wrong population/baseline instead of the requested quality, fairness or explanation.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','state_mismatch','State or representation mismatch','Breaks fitted transformations, schemas, versions, entity/time alignment or reproducible inputs.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','wrong_boundary','Wrong boundary or timing','Applies protection/control after exposure, at the wrong layer, or uses stale/immature data at the wrong moment.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','unnecessary_operations','Avoidable operational work','Adds custom infrastructure, manual coordination or migration without a scenario benefit.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','wasted_resources','Wasted resources','Consumes unnecessary compute, storage, tokens, trials or idle capacity while a feasible lower-work choice exists.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','insufficient_capacity','Insufficient capacity or scaling signal','Uses a poor scaling metric, replica/memory allocation, warm-up strategy or parallelism for demand.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','excess_privilege','Excessive or wrong access scope','Uses incorrect identity, broad grant, group/hierarchy scope or location policy.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','unsafe_lifecycle','Unsafe lifecycle or delivery','Loses work, disrupts availability, mixes experiment cohorts, bypasses approval or lacks safe rollout/recovery.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('failure_mode','unsupported_assumption','Unsupported assumption or configuration','Relies on unsupported compatibility/settings or assumes guarantees not supplied by the scenario; use only when the rationale explicitly supports this, never as a miscellaneous label.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','agent_platform','Gemini Enterprise Agent Platform','Managed AI platform family; normalize historical Vertex AI and short Agent Platform names. Use a specific subservice instead when that is the decision hinge.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','automl','Agent Platform AutoML','Managed AutoML training; includes historical AutoML Tables/Vision naming without endorsing lifecycle validity.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','workbench','Agent Platform Workbench','Managed interactive notebook environment.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','pipelines','Agent Platform Pipelines','Managed ML pipeline execution, including TFX/KFP integration.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','feature_store','Agent Platform Feature Store','Feature registry, feature groups, views, synchronization and online serving.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','model_registry','Agent Platform Model Registry','Model registration, versions and aliases.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','ml_metadata','Agent Platform ML Metadata','Artifact/execution/event lineage.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','experiments','Agent Platform Experiments and TensorBoard','Experiment parameters, metrics and training visualizations.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','custom_training','Agent Platform custom training','Managed custom training and tuning jobs.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','inference','Agent Platform Inference','Managed prediction endpoints, batch prediction and custom inference routines.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','model_monitoring','Agent Platform Model Monitoring','Feature, prediction and attribution distribution monitoring.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','genai_evaluation','Agent Platform Gen AI evaluation','Offline/online generative response, trajectory and session evaluation.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','explainable_ai','Explainable AI','Model feature attributions and explanation baselines.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','model_garden','Model Garden','Foundation model discovery, model cards, managed APIs and deployment/tuning entrypoints.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','gemini','Gemini','Gemini foundation models/APIs; do not infer it merely from platform branding.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','bigquery','BigQuery','Analytics storage, SQL, snapshots, layout, and Storage Read API.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','bigquery_ml','BigQuery ML','SQL model training, inference and AI functions.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_storage','Cloud Storage','Object storage, versioned objects and bucket-based data/artifacts.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','dataflow','Dataflow','Managed Apache Beam batch and streaming processing.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','dataproc','Dataproc','Managed Spark/Hadoop processing.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_composer','Cloud Composer','Managed Airflow workflow orchestration.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_run','Cloud Run','Managed request-serving containers and jobs, including Cloud Run functions.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','gke','Google Kubernetes Engine','Managed Kubernetes, Standard and Autopilot.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','compute_engine','Compute Engine','VMs, instance groups, images, disks and VM Manager.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_tpu','Cloud TPU','TPU training/inference hardware.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_build','Cloud Build','Build triggers and CI execution/approvals.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_deploy','Cloud Deploy','Delivery pipelines and progressive rollout automation.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','artifact_registry','Artifact Registry','Container artifacts and reusable pipeline templates.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','pubsub','Pub/Sub','Publish/subscribe topics and independent consumers.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_tasks','Cloud Tasks','Durable task delivery and retry control.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_monitoring','Cloud Monitoring','Metrics, dashboards, scopes and alert policies.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_logging','Cloud Logging','Application, platform and audit logs.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_trace','Cloud Trace','Distributed and agent trace collection.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_profiler','Cloud Profiler','Application execution and resource profiling.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','iam','IAM and Cloud Identity','Identities, groups, role grants, federation and resource access scope.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','vpc','VPC and private connectivity','VPC networks, subnets, Private Google Access, Private Service Connect and network perimeters.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_kms','Cloud KMS','Encryption keys including CMEK and tokenization key wrapping.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','sensitive_data_protection','Sensitive Data Protection','DLP inspection, de-identification, deterministic encryption and risk analysis.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','model_armor','Model Armor','Prompt/response threat screening and data sanitization.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','security_command_center','Security Command Center','AI Protection and threat findings.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','translation','Cloud Translation','Text/document translation, glossary and batch/online APIs.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','document_ai','Document AI','Document OCR, extraction and processors.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','retail','Retail Search and Recommendations','Managed retail search and recommendations, including historical Retail API naming.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','storage_transfer','Storage Transfer Service','Managed object/file transfer to Cloud Storage.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','netapp_volumes','Google Cloud NetApp Volumes','Managed file shares including SMB/Active Directory integration.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]),
('product','cloud_billing','Cloud Billing','Billing accounts, project links, budgets and billing roles.',ARRAY['machine-learning-engineer','cloud-engineer']::text[]);
COMMIT;
