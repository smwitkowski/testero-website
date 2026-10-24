-- Migration C: saved snapshots never authorize withdrawn questions. Apply after A/B.
BEGIN;
-- Exclusion is a session snapshot, not a view of today's bank status.
ALTER TABLE public.session_items ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
ALTER TABLE public.mock_exam_items ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS session_items_question_id_idx ON public.session_items(question_id);
-- Repair pre-C unfinished attempts and legacy completed exclusions. Never alter
-- the denominator of a fully scored/answered historical snapshot.
UPDATE public.session_items i SET withdrawn_at = clock_timestamp()
 FROM public.study_sessions s WHERE s.id = i.session_id AND ((s.completed_at IS NOT NULL AND i.answered_at IS NULL) OR (s.completed_at IS NULL
 AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = i.question_id AND q.status = 'ACTIVE' AND q.review_status = 'GOOD')));
UPDATE public.mock_exam_items i SET withdrawn_at = clock_timestamp()
 FROM public.mock_exam_sessions s WHERE s.id = i.session_id AND ((s.completed_at IS NOT NULL AND i.is_correct IS NULL) OR (s.completed_at IS NULL
 AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = i.question_id AND q.status = 'ACTIVE' AND q.review_status = 'GOOD')));
CREATE OR REPLACE FUNCTION public.snapshot_question_withdrawal() RETURNS TRIGGER
 LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $snapshot$
BEGIN
 IF (NEW.status <> 'ACTIVE' OR NEW.review_status <> 'GOOD')
 AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.review_status IS DISTINCT FROM NEW.review_status) THEN
  UPDATE public.session_items i SET withdrawn_at = coalesce(i.withdrawn_at,clock_timestamp())
   FROM public.study_sessions s WHERE s.id = i.session_id AND s.completed_at IS NULL AND i.question_id = NEW.id;
  UPDATE public.mock_exam_items i SET withdrawn_at = coalesce(i.withdrawn_at,clock_timestamp())
   FROM public.mock_exam_sessions s WHERE s.id = i.session_id AND s.completed_at IS NULL AND i.question_id = NEW.id;
 END IF;
 RETURN NEW;
END;
$snapshot$;
REVOKE ALL ON FUNCTION public.snapshot_question_withdrawal() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS snapshot_question_withdrawal ON public.questions;
CREATE TRIGGER snapshot_question_withdrawal AFTER UPDATE OF status,review_status ON public.questions
 FOR EACH ROW EXECUTE FUNCTION public.snapshot_question_withdrawal();
CREATE OR REPLACE FUNCTION public.answer_study_item(
 p_session_id UUID, p_item_id UUID, p_selected_label TEXT,
 p_user_id UUID DEFAULT NULL, p_anonymous_owner_hash TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
 v_session public.study_sessions%ROWTYPE;
 v_item public.session_items%ROWTYPE;
 v_next INTEGER;
 v_answered INTEGER;
 v_total INTEGER;
 v_withdrawn BOOLEAN;
BEGIN
 SELECT * INTO v_session FROM public.study_sessions WHERE id = p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = '22023'; END IF;
 IF (p_user_id IS NULL) = (p_anonymous_owner_hash IS NULL)
 OR v_session.user_id IS DISTINCT FROM p_user_id
 OR v_session.anonymous_owner_hash IS DISTINCT FROM p_anonymous_owner_hash THEN
  RAISE EXCEPTION 'Session owner mismatch' USING ERRCODE = '42501';
 END IF;
 -- Check wall-clock time after acquiring the session lock, including lock waits.
 IF v_session.expires_at <= clock_timestamp() THEN
  RAISE EXCEPTION 'Session expired' USING ERRCODE = '22023';
 END IF;
 SELECT * INTO v_item FROM public.session_items WHERE id = p_item_id AND session_id = p_session_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Item not found' USING ERRCODE = '22023'; END IF;
 -- Serialize against quarantine/retirement; status may change while waiting.
 PERFORM q.id FROM public.questions q JOIN public.session_items i ON i.question_id = q.id
  WHERE i.session_id = p_session_id ORDER BY q.id FOR SHARE OF q;
 IF v_session.expires_at <= clock_timestamp() THEN
  RAISE EXCEPTION 'Session expired' USING ERRCODE = '22023';
 END IF;
 -- Persist all currently invalid items before counting, including a skip made
 -- by answering a different item. Completed denominators never change here.
 IF v_session.completed_at IS NULL THEN
  UPDATE public.session_items i SET withdrawn_at = coalesce(i.withdrawn_at,clock_timestamp())
   WHERE i.session_id = p_session_id AND NOT EXISTS (SELECT 1 FROM public.questions q
    WHERE q.id = i.question_id AND q.status = 'ACTIVE' AND q.review_status = 'GOOD');
 END IF;
 SELECT (i.withdrawn_at IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.questions q
  WHERE q.id = i.question_id AND q.status = 'ACTIVE' AND q.review_status = 'GOOD')) INTO v_withdrawn
  FROM public.session_items i WHERE i.id = p_item_id;
 IF NOT v_withdrawn THEN
 IF p_selected_label IS NULL OR NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(v_item.options) WHERE value->>'label' = p_selected_label
 ) THEN RAISE EXCEPTION 'Invalid selected label' USING ERRCODE = '22023'; END IF;
 IF v_item.answered_at IS NOT NULL THEN
  IF v_item.selected_label IS DISTINCT FROM p_selected_label THEN
   RAISE EXCEPTION 'Answer already recorded' USING ERRCODE = '22023';
  END IF;
 ELSE
  SELECT min(i.ordinal) INTO v_next FROM public.session_items i JOIN public.questions q ON q.id = i.question_id
   WHERE i.session_id = p_session_id AND i.answered_at IS NULL AND i.withdrawn_at IS NULL AND q.status = 'ACTIVE' AND q.review_status = 'GOOD';
  IF v_session.completed_at IS NOT NULL OR v_item.ordinal IS DISTINCT FROM v_next THEN
   RAISE EXCEPTION 'Answer the next item in order' USING ERRCODE = '22023';
  END IF;
  UPDATE public.session_items SET selected_label = p_selected_label,
   is_correct = (correct_label = p_selected_label), answered_at = now() WHERE id = p_item_id;
 END IF;
 END IF;
 SELECT count(*), count(*) FILTER (WHERE i.answered_at IS NOT NULL) INTO v_total, v_answered
  FROM public.session_items i JOIN public.questions q ON q.id = i.question_id
  WHERE i.session_id = p_session_id AND i.withdrawn_at IS NULL;
 IF v_answered = v_total THEN
  UPDATE public.study_sessions SET completed_at = coalesce(completed_at,now()) WHERE id = p_session_id;
 END IF;
 RETURN jsonb_build_object('answeredCount',v_answered,'totalQuestions',v_total,'withdrawn',v_withdrawn,
  'completed',v_answered = v_total);
END;
$fn$;
CREATE OR REPLACE FUNCTION public.interact_mock_exam(p_user_id UUID, p_session_id UUID, p_action TEXT,
 p_item_id UUID DEFAULT NULL, p_selected_label TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_session public.mock_exam_sessions%ROWTYPE; v_now TIMESTAMPTZ; v_count INTEGER; v_withdrawn BOOLEAN := false;
BEGIN
 PERFORM public.require_mock_paid_access(p_user_id);
 IF p_action IS NULL OR p_action NOT IN ('read','answer','submit','results') THEN
  RAISE EXCEPTION 'Invalid mock action' USING ERRCODE = '22023'; END IF;
 SELECT * INTO v_session FROM public.mock_exam_sessions WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mock not found' USING ERRCODE = 'P0002'; END IF;
 PERFORM public.require_mock_paid_access(p_user_id);
 -- Hold the bank rows through answer/score commit, including lock waits.
 PERFORM q.id FROM public.questions q JOIN public.mock_exam_items i ON i.question_id = q.id
  WHERE i.session_id = p_session_id ORDER BY q.id FOR SHARE OF q;
 PERFORM public.require_mock_paid_access(p_user_id);
 v_now := clock_timestamp();
 IF v_session.completed_at IS NULL THEN
  UPDATE public.mock_exam_items i SET withdrawn_at = coalesce(i.withdrawn_at,v_now)
   WHERE i.session_id = p_session_id AND NOT EXISTS (SELECT 1 FROM public.questions q
    WHERE q.id = i.question_id AND q.status = 'ACTIVE' AND q.review_status = 'GOOD');
  IF v_session.deadline_at <= v_now OR p_action = 'submit' THEN
   UPDATE public.mock_exam_items i SET is_correct = CASE WHEN i.withdrawn_at IS NULL THEN coalesce(i.selected_label = i.correct_label,false) ELSE NULL END WHERE i.session_id = p_session_id;
   UPDATE public.mock_exam_sessions SET completed_at = least(v_now,deadline_at), timed_out = (deadline_at <= v_now)
    WHERE id = p_session_id RETURNING * INTO v_session;
  ELSIF p_action = 'answer' THEN
   IF NOT EXISTS (SELECT 1 FROM public.mock_exam_items WHERE id = p_item_id AND session_id = p_session_id) THEN
    RAISE EXCEPTION 'Invalid mock answer' USING ERRCODE = '22023'; END IF;
   SELECT NOT EXISTS (SELECT 1 FROM public.mock_exam_items i JOIN public.questions q ON q.id = i.question_id
    WHERE i.id = p_item_id AND i.session_id = p_session_id AND i.withdrawn_at IS NULL AND q.status = 'ACTIVE' AND q.review_status = 'GOOD') INTO v_withdrawn;
   IF NOT v_withdrawn THEN
   IF p_selected_label IS NULL OR NOT EXISTS (SELECT 1 FROM public.mock_exam_items i,
    LATERAL jsonb_array_elements(i.options) o WHERE i.id = p_item_id AND i.session_id = p_session_id AND o->>'label' = p_selected_label) THEN
    RAISE EXCEPTION 'Invalid mock answer' USING ERRCODE = '22023'; END IF;
   -- A mock allows changing an answer before final submission, without feedback.
   UPDATE public.mock_exam_items SET selected_label = p_selected_label, answered_at = v_now
    WHERE id = p_item_id AND session_id = p_session_id;
   END IF;
  END IF;
 END IF;
 SELECT count(*) INTO v_count FROM public.mock_exam_items WHERE session_id = p_session_id AND withdrawn_at IS NULL AND answered_at IS NOT NULL;
 RETURN jsonb_build_object('id',v_session.id,'user_id',v_session.user_id,'question_count',v_session.question_count,
  'created_at',v_session.created_at,'deadline_at',v_session.deadline_at,'completed_at',v_session.completed_at,
  'timed_out',v_session.timed_out,'allocation_notice',v_session.allocation_notice,'server_now',clock_timestamp(),'answered_count',v_count,'withdrawn',v_withdrawn);
END;
$fn$;
-- One bounded, service-only history call replaces per-attempt reads. Lock rows in
-- stable order, then check the wall clock and paid access again after any wait.
CREATE OR REPLACE FUNCTION public.mock_exam_history(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_ids UUID[]; v_expired UUID[]; v_now TIMESTAMPTZ; v_result JSONB;
BEGIN
 PERFORM public.require_mock_paid_access(p_user_id);
 SELECT array_agg(locked.id) INTO v_ids FROM (
  SELECT id FROM public.mock_exam_sessions WHERE user_id = p_user_id
   ORDER BY created_at DESC, id DESC LIMIT 50 FOR UPDATE
 ) locked;
 PERFORM public.require_mock_paid_access(p_user_id);
 PERFORM q.id FROM public.questions q JOIN public.mock_exam_items i ON i.question_id = q.id
  WHERE i.session_id = ANY(v_ids) ORDER BY q.id FOR SHARE OF q;
 v_now := clock_timestamp();
 SELECT array_agg(id) INTO v_expired FROM public.mock_exam_sessions
  WHERE id = ANY(v_ids) AND user_id = p_user_id AND completed_at IS NULL AND deadline_at <= v_now;
 UPDATE public.mock_exam_items i SET withdrawn_at = coalesce(i.withdrawn_at,v_now)
  WHERE i.session_id = ANY(v_expired) AND NOT EXISTS (SELECT 1 FROM public.questions q
   WHERE q.id = i.question_id AND q.status = 'ACTIVE' AND q.review_status = 'GOOD');
 UPDATE public.mock_exam_items i SET is_correct = CASE WHEN i.withdrawn_at IS NULL
  THEN coalesce(i.selected_label = i.correct_label,false) ELSE NULL END WHERE i.session_id = ANY(v_expired);
 UPDATE public.mock_exam_sessions SET completed_at = deadline_at, timed_out = true
  WHERE id = ANY(v_expired) AND user_id = p_user_id;
 -- No item data or provisional scores leave this RPC. Incomplete/corrupt scored
 -- snapshots yield NULL, which the server rejects for a completed attempt.
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'user_id',s.user_id,
  'created_at',s.created_at,'deadline_at',s.deadline_at,'completed_at',s.completed_at,
  'question_count',s.question_count,'score',CASE WHEN s.completed_at IS NOT NULL
   AND scores.snapshot_count = s.question_count AND scores.valid_count = scores.item_count
   THEN CASE WHEN scores.item_count = 0 THEN 0 ELSE round(100.0 * scores.correct_count / scores.item_count)::integer END ELSE NULL END)
  ORDER BY s.created_at DESC,s.id DESC),'[]'::jsonb) INTO v_result
 FROM public.mock_exam_sessions s LEFT JOIN (
  SELECT session_id,count(*) AS snapshot_count,count(*) FILTER (WHERE i.withdrawn_at IS NULL) AS item_count,
   count(*) FILTER (WHERE i.withdrawn_at IS NULL AND i.is_correct) AS correct_count,
   count(*) FILTER (WHERE i.withdrawn_at IS NULL
    AND i.is_correct IS NOT DISTINCT FROM coalesce(i.selected_label = i.correct_label,false)) AS valid_count
  FROM public.mock_exam_items i
  WHERE i.session_id = ANY(v_ids) GROUP BY i.session_id
 ) scores ON scores.session_id = s.id
 WHERE s.id = ANY(v_ids) AND s.user_id = p_user_id;
 PERFORM public.require_mock_paid_access(p_user_id);
 RETURN v_result;
END;
$fn$;
COMMIT;
