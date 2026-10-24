-- READ ONLY. psql -v artifact_ids='["uuid",...]' -f draft_provenance.sql
-- Build the complete local-id manifest with scripts.draft_provenance --artifact-ids.
-- An empty manifest is explicit: [] means no matching local persisted artifact ids.
-- No server-side filesystem reads, temp tables, migrations, DDL or updates.
BEGIN READ ONLY;
WITH local_artifacts AS (
  SELECT jsonb_array_elements_text(:'artifact_ids'::jsonb) AS question_id
), provenance AS (
  SELECT CASE WHEN q.created_at < TIMESTAMPTZ '2026-10-04 00:00:00+00'
              THEN 'before' ELSE 'on_or_after' END AS created_bucket,
         q.generation_run_id, q.review_status,
         EXISTS (SELECT 1 FROM local_artifacts a WHERE a.question_id = q.id::text) AS local_artifact_exists
  FROM public.questions q
  WHERE q.exam = 'GCP_PM_ML_ENG' AND q.status = 'DRAFT'
)
SELECT created_bucket, generation_run_id, review_status, local_artifact_exists, count(*) AS draft_count
FROM provenance
GROUP BY created_bucket, generation_run_id, review_status, local_artifact_exists
ORDER BY created_bucket, generation_run_id NULLS FIRST, review_status, local_artifact_exists;
ROLLBACK;
