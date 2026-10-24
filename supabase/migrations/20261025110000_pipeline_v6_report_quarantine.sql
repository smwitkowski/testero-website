-- Pipeline v6 B: ownership-bound reports, bounded automatic quarantine, mocks.
BEGIN;
ALTER TABLE public.question_reports
 ALTER COLUMN session_id DROP NOT NULL,
 ALTER COLUMN item_id DROP NOT NULL,
 ADD COLUMN mock_session_id UUID REFERENCES public.mock_exam_sessions(id),
 ADD COLUMN mock_item_id UUID REFERENCES public.mock_exam_items(id),
 ADD CONSTRAINT question_reports_exact_source CHECK (
  (session_id IS NOT NULL AND item_id IS NOT NULL AND mock_session_id IS NULL AND mock_item_id IS NULL) OR
  (session_id IS NULL AND item_id IS NULL AND mock_session_id IS NOT NULL AND mock_item_id IS NOT NULL));
CREATE INDEX question_reports_question_time_idx ON public.question_reports(question_id,created_at DESC);

-- Retain the deployed frontend signature and void response. Item/question IDs
-- always come from an owned stored snapshot, never a caller-supplied bank ID.
CREATE OR REPLACE FUNCTION public.submit_question_report(p_session_id UUID,p_item_id UUID,p_kind TEXT,
 p_user_id UUID,p_anonymous_owner_hash TEXT,p_reason TEXT,p_note TEXT,p_email TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE s public.study_sessions; m public.mock_exam_sessions; q public.questions;
 v_question_id UUID; v_owner TEXT; v_report_id UUID; v_result JSONB; v_outcome TEXT;
 v_day TIMESTAMPTZ; v_page BOOLEAN := false;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('diagnostic','practice','mock') OR p_reason IS NULL
 OR p_reason NOT IN ('wrong answer','unclear','outdated','typo','other') OR p_note IS NULL
 OR length(p_note)>2000 OR p_email IS NULL OR length(p_email)>254 THEN
  RAISE EXCEPTION 'Invalid report arguments' USING ERRCODE='22023';
 END IF;
 IF p_kind = 'mock' THEN
  SELECT * INTO m FROM public.mock_exam_sessions WHERE id=p_session_id AND user_id=p_user_id;
  IF NOT FOUND OR p_user_id IS NULL OR m.completed_at IS NULL THEN
   RAISE EXCEPTION 'Question not found' USING ERRCODE='42501';
  END IF;
  v_owner := 'user:'||m.user_id;
  SELECT question_id INTO v_question_id FROM public.mock_exam_items WHERE id=p_item_id AND session_id=p_session_id;
 ELSE
  SELECT * INTO s FROM public.study_sessions WHERE id=p_session_id AND kind=p_kind;
  IF NOT FOUND OR (s.completed_at IS NULL AND s.expires_at<=clock_timestamp()) THEN
   RAISE EXCEPTION 'Question not found' USING ERRCODE='42501';
  END IF;
  IF s.user_id IS NOT NULL AND s.anonymous_owner_hash IS NULL AND s.user_id=p_user_id THEN
   v_owner := 'user:'||s.user_id;
  ELSIF s.user_id IS NULL AND s.anonymous_owner_hash IS NOT NULL AND s.anonymous_owner_hash=p_anonymous_owner_hash THEN
   v_owner := 'anon:'||s.anonymous_owner_hash;
  ELSE RAISE EXCEPTION 'Question not found' USING ERRCODE='42501'; END IF;
  SELECT question_id INTO v_question_id FROM public.session_items WHERE id=p_item_id AND session_id=p_session_id;
 END IF;
 IF v_question_id IS NULL THEN RAISE EXCEPTION 'Question not found' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('question-report:'||v_owner,0));
 IF (SELECT count(*) FROM public.question_reports WHERE owner_key=v_owner AND created_at>clock_timestamp()-interval '1 hour') >= 10 THEN
  RAISE EXCEPTION 'Report limit exceeded' USING ERRCODE='P0001';
 END IF;
 INSERT INTO public.question_reports(session_id,item_id,mock_session_id,mock_item_id,question_id,owner_key,reason,note,email)
 VALUES(CASE WHEN p_kind<>'mock' THEN p_session_id END,CASE WHEN p_kind<>'mock' THEN p_item_id END,
  CASE WHEN p_kind='mock' THEN p_session_id END,CASE WHEN p_kind='mock' THEN p_item_id END,
  v_question_id,v_owner,p_reason,p_note,p_email) RETURNING id INTO v_report_id;

 IF p_reason IN ('wrong answer','outdated') THEN
  -- Owner hashes are cheap to mint; the global lock serializes the DAILY cap
  -- across owners/domains. It precedes the shared lifecycle domain/row locks.
  PERFORM pg_advisory_xact_lock(hashtextextended('question-report-global-quarantine',0));
  q := public.lock_question_lifecycle(v_question_id);
  IF q.review_status='QUARANTINED' THEN
   v_outcome := 'already_quarantined'; -- per-question dedupe, across all owners
  ELSIF q.status IS DISTINCT FROM 'ACTIVE' THEN
   v_outcome := 'not_active';
  ELSE
   v_page := EXISTS (SELECT 1 FROM public.question_events WHERE question_id=q.id
      AND revision=q.revision AND action='restored');
   v_day := date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
   IF (SELECT count(*) FROM public.question_events WHERE action='quarantined' AND actor='question-report'
       AND at>=v_day AND at<v_day+interval '1 day') >= 5 THEN
    v_outcome := 'daily_cap'; v_page := true;
   ELSE
    v_result := public.quarantine_question(q.id,p_reason,'question-report',
      jsonb_build_object('report_id',v_report_id,'report_driven',true,'founder_page',v_page));
    v_outcome := v_result->>'outcome';
    IF v_outcome='floor_blocked' THEN v_page := true; END IF;
   END IF;
  END IF;
 ELSE
  q := public.lock_question_lifecycle(v_question_id);
  v_outcome := 'recorded';
 END IF;
 INSERT INTO public.question_events(question_id,revision,actor,action,reason,payload)
 VALUES(q.id,q.revision,'question-report','report',p_reason,
  jsonb_build_object('report_id',v_report_id,'outcome',v_outcome,'founder_page',v_page,'kind',p_kind));
END;
$fn$;
REVOKE ALL ON FUNCTION public.submit_question_report(UUID,UUID,TEXT,UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_question_report(UUID,UUID,TEXT,UUID,TEXT,TEXT,TEXT,TEXT) TO service_role;
COMMIT;
