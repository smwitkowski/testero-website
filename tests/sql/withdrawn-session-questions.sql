-- LOCAL ONLY. Coordinator runs after migrations A-C, with ON_ERROR_STOP.
-- Every fixture, bank change and score rolls back. No shared reset is required.
BEGIN;
DO $test$
DECLARE
 v_user UUID := gen_random_uuid(); v_domain UUID := gen_random_uuid();
 v_live UUID := gen_random_uuid(); v_withdrawn UUID := gen_random_uuid();
 v_session UUID; v_item UUID; v_result JSONB; v_mock UUID := gen_random_uuid();
 v_opts JSONB := '[{"label":"A","text":"One"},{"label":"B","text":"Two"}]';
 v_kind TEXT; v_score INTEGER;
BEGIN
 INSERT INTO auth.users(id,email) VALUES(v_user,v_user::text||'@withdrawn.example.test');
 INSERT INTO public.user_subscriptions(user_id,stripe_customer_id,status)
 VALUES(v_user,'withdrawn-test-'||v_user::text,'active');
 INSERT INTO public.exam_domains(id,exam,code,name)
 VALUES(v_domain,'GCP_PM_ML_ENG','WITHDRAWN_'||v_domain::text,'Withdrawal test');
 INSERT INTO public.questions(id,exam,domain_id,stem,status,review_status)
 VALUES(v_live,'GCP_PM_ML_ENG',v_domain,'Live fixture','ACTIVE','GOOD'),
       (v_withdrawn,'GCP_PM_ML_ENG',v_domain,'Withdrawn fixture','DRAFT','QUARANTINED');
 FOREACH v_kind IN ARRAY ARRAY['diagnostic','practice'] LOOP
  v_session := gen_random_uuid(); v_item := gen_random_uuid();
  INSERT INTO public.study_sessions(id,kind,user_id,question_count,domain_codes,expires_at)
  VALUES(v_session,v_kind,v_user,2,ARRAY['WITHDRAWN'],now()+interval '1 hour');
  INSERT INTO public.session_items(id,session_id,ordinal,question_id,domain_code,domain_name,stem,options,correct_label)
  VALUES(v_item,v_session,1,v_withdrawn,'WITHDRAWN','Withdrawal test','Withdrawn saved snapshot',v_opts,'A'),
        (gen_random_uuid(),v_session,2,v_live,'WITHDRAWN','Withdrawal test','Live saved snapshot',v_opts,'A');
  v_result := public.answer_study_item(v_session,v_item,'A',v_user,NULL);
  IF v_result IS DISTINCT FROM '{"answeredCount":0,"totalQuestions":1,"completed":false,"withdrawn":true}'::jsonb THEN
   RAISE EXCEPTION 'Withdrawn % answer did not skip: %',v_kind,v_result; END IF;
  IF EXISTS(SELECT 1 FROM public.session_items WHERE id=v_item AND (selected_label IS NOT NULL OR answered_at IS NOT NULL OR is_correct IS NOT NULL)) THEN
   RAISE EXCEPTION 'Withdrawn study answer was persisted'; END IF;
  SELECT id INTO v_item FROM public.session_items WHERE session_id=v_session AND question_id=v_live;
  v_result := public.answer_study_item(v_session,v_item,'A',v_user,NULL);
  IF v_result->>'completed' <> 'true' OR v_result->>'answeredCount' <> '1' THEN
   RAISE EXCEPTION 'Study did not complete after active item answered: %',v_result; END IF;
 END LOOP;
 -- All withdrawn: a stale answer finishes safely with no answer or key.
 UPDATE public.questions SET status='RETIRED' WHERE id=v_live;
 v_result := public.answer_study_item(v_session,v_item,'A',v_user,NULL);
 IF v_result->>'totalQuestions' <> '0' OR v_result->>'completed' <> 'true' OR v_result->>'withdrawn' <> 'true' THEN
  RAISE EXCEPTION 'All-withdrawn study did not complete: %',v_result; END IF;
 UPDATE public.questions SET status='ACTIVE' WHERE id=v_live;
 INSERT INTO public.mock_exam_sessions(id,user_id,question_count,deadline_at)
 VALUES(v_mock,v_user,50,clock_timestamp()+interval '2 hours');
 INSERT INTO public.mock_exam_items(session_id,ordinal,question_id,domain_code,domain_name,stem,options,correct_label,selected_label,answered_at)
 SELECT v_mock,n,CASE WHEN n=1 THEN v_withdrawn ELSE v_live END,'WITHDRAWN','Withdrawal test','Mock snapshot',v_opts,'A',
  CASE WHEN n=1 THEN NULL ELSE 'A' END,CASE WHEN n=1 THEN NULL ELSE clock_timestamp() END FROM generate_series(1,50) n;
 SELECT id INTO v_item FROM public.mock_exam_items WHERE session_id=v_mock AND ordinal=1;
 v_result := public.interact_mock_exam(v_user,v_mock,'answer',v_item,'B');
 IF v_result->>'withdrawn' <> 'true' THEN RAISE EXCEPTION 'Mock withdrawal flag missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.mock_exam_items WHERE id=v_item AND selected_label IS NOT NULL) THEN
  RAISE EXCEPTION 'Mock accepted withdrawn answer'; END IF;
 PERFORM public.interact_mock_exam(v_user,v_mock,'submit');
 IF EXISTS(SELECT 1 FROM public.mock_exam_items WHERE id=v_item AND is_correct IS NOT NULL) THEN
  RAISE EXCEPTION 'Mock scored withdrawn question as wrong'; END IF;
 SELECT (entry->>'score')::integer INTO v_score FROM jsonb_array_elements(public.mock_exam_history(v_user)) entry WHERE entry->>'id'=v_mock::text;
 IF v_score IS DISTINCT FROM 100 THEN RAISE EXCEPTION 'Mock history denominator included withdrawn item: %',v_score; END IF;
 -- A completed attempt also excludes questions withdrawn after submission.
 UPDATE public.questions SET status='RETIRED' WHERE id=v_live;
 SELECT (entry->>'score')::integer INTO v_score FROM jsonb_array_elements(public.mock_exam_history(v_user)) entry WHERE entry->>'id'=v_mock::text;
 IF v_score IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'All-withdrawn mock score should be zero: %',v_score; END IF;
 IF has_function_privilege('anon','public.answer_study_item(uuid,uuid,text,uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.interact_mock_exam(uuid,uuid,text,uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Withdrawal RPC permissions leaked'; END IF;
END;
$test$;
ROLLBACK;
