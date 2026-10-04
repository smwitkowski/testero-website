-- Read-only production post-checks; transaction raises on wrong v2 privileges.
-- No user rows or credential values are returned.
BEGIN READ ONLY;
DO $verify$
DECLARE t TEXT; r TEXT; signature TEXT;
BEGIN
 FOREACH t IN ARRAY ARRAY['exam_domains','question_generation_runs','questions','answers','explanations',
 'user_subscriptions','payment_history','webhook_events','study_sessions','session_items','free_practice_quota','pmle_passes','pmle_pass_refunds'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity) THEN
   RAISE EXCEPTION 'Missing table or RLS: %',t;
  END IF;
  IF NOT (has_table_privilege('service_role','public.'||quote_ident(t),'SELECT')
   AND has_table_privilege('service_role','public.'||quote_ident(t),'INSERT')
   AND has_table_privilege('service_role','public.'||quote_ident(t),'UPDATE')
   AND has_table_privilege('service_role','public.'||quote_ident(t),'DELETE')) THEN
   RAISE EXCEPTION 'Missing service access: %',t;
  END IF;
 END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH t IN ARRAY ARRAY['exam_domains','question_generation_runs','questions','answers','explanations','session_items','free_practice_quota','webhook_events','pmle_pass_refunds'] LOOP
   IF has_table_privilege(r,'public.'||quote_ident(t),'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Unexpected browser privilege: % %',r,t;
   END IF;
  END LOOP;
  FOREACH signature IN ARRAY ARRAY[
   'create_study_session(text,uuid,text,jsonb,timestamptz)',
   'answer_study_item(uuid,uuid,text,uuid,text)',
   'consume_free_practice_quota(uuid,integer)',
   'v2_consume_free_practice_quota(uuid,integer)',
   'v2_create_study_session(text,uuid,text,jsonb,timestamptz,boolean)',
   'create_free_practice_session(uuid,jsonb,timestamptz)',
   'claim_anonymous_diagnostics(uuid,text)',
   'fulfill_pmle_pass(uuid,text,text,text,timestamptz)',
   'refund_pmle_pass(text,timestamptz)',
   'record_pmle_pass_payment(text,integer,text)'] LOOP
   IF has_function_privilege(r,'public.'||signature,'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected browser RPC privilege: % %',r,signature;
   END IF;
   IF NOT has_function_privilege('service_role','public.'||signature,'EXECUTE') THEN
    RAISE EXCEPTION 'Missing service RPC access: %',signature;
   END IF;
  END LOOP;
  IF to_regprocedure('public.upsert_question_answers(uuid,jsonb)') IS NOT NULL
   AND has_function_privilege(r,'public.upsert_question_answers(uuid,jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Legacy answer writer is still browser-accessible: %',r;
  END IF;
 END LOOP;
 IF to_regprocedure('public.upsert_question_answers(uuid,jsonb)') IS NOT NULL
  AND NOT has_function_privilege('service_role','public.upsert_question_answers(uuid,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Preserved answer writer lost service access';
 END IF;
 FOREACH t IN ARRAY ARRAY['user_subscriptions','payment_history','study_sessions','pmle_passes'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t
   AND policyname='v2_owner_gate' AND permissive='RESTRICTIVE' AND cmd='SELECT'
   AND roles=ARRAY['authenticated']::name[] AND qual LIKE '%auth.uid()%user_id%') THEN
   RAISE EXCEPTION 'Missing restrictive owner SELECT gate: %',t;
  END IF;
 END LOOP;
END
$verify$;
SELECT 'PASS v2 RLS, service-only RPCs, browser denial and owner gates' AS result;
SELECT status,count(*) FROM public.questions GROUP BY status ORDER BY status;
SELECT d.code,count(*) FILTER(WHERE q.status='ACTIVE') AS active,
 count(*) FILTER(WHERE q.status='ACTIVE' AND q.review_status='GOOD') AS eligible
FROM public.exam_domains d LEFT JOIN public.questions q ON q.domain_id=d.id
WHERE d.code IN ('ARCHITECTING_LOW_CODE_ML_SOLUTIONS','COLLABORATING_TO_MANAGE_DATA_AND_MODELS',
 'SCALING_PROTOTYPES_INTO_ML_MODELS','SERVING_AND_SCALING_MODELS',
 'AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES','MONITORING_ML_SOLUTIONS')
GROUP BY d.code ORDER BY d.code;
COMMIT;
