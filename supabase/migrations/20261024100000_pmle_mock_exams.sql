-- Pass-only timed mocks. Apply locally/test only; coordinator applies after approval.
BEGIN;
CREATE TABLE public.mock_exam_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 question_count INTEGER NOT NULL CHECK (question_count = 50),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 deadline_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ,
 timed_out BOOLEAN NOT NULL DEFAULT false, allocation_notice TEXT,
 CHECK (isfinite(deadline_at) AND deadline_at > created_at),
 CHECK (completed_at IS NULL OR isfinite(completed_at))
);
CREATE TABLE public.mock_exam_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES public.mock_exam_sessions(id) ON DELETE CASCADE,
 ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 1 AND 50), question_id UUID NOT NULL REFERENCES public.questions(id),
 domain_code TEXT NOT NULL, domain_name TEXT NOT NULL, stem TEXT NOT NULL,
 options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array'), correct_label TEXT NOT NULL,
 selected_label TEXT, answered_at TIMESTAMPTZ, is_correct BOOLEAN,
 UNIQUE (session_id, ordinal),
 CHECK ((selected_label IS NULL) = (answered_at IS NULL))
);
CREATE INDEX mock_exam_sessions_user_created_idx ON public.mock_exam_sessions(user_id, created_at DESC);
CREATE INDEX mock_exam_items_session_idx ON public.mock_exam_items(session_id);
CREATE INDEX mock_exam_items_question_idx ON public.mock_exam_items(question_id);
ALTER TABLE public.mock_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_exam_items ENABLE ROW LEVEL SECURITY;
-- No browser reads: item keys must never be available during an exam, even to its owner.
REVOKE ALL ON TABLE public.mock_exam_sessions, public.mock_exam_items FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mock_exam_sessions, public.mock_exam_items TO service_role;

CREATE OR REPLACE FUNCTION public.require_mock_paid_access(p_user_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
 IF p_user_id IS NULL OR (
  NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id AND status = 'active')
  AND NOT EXISTS (SELECT 1 FROM public.pmle_passes WHERE user_id = p_user_id AND paid_at <= v_now AND expires_at > v_now AND refunded_at IS NULL)
 ) THEN RAISE EXCEPTION 'PMLE Pass required' USING ERRCODE = '42501'; END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.create_mock_exam(p_user_id UUID, p_items JSONB, p_allocation_notice TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_id UUID; v_item JSONB; v_option JSONB; v_ordinal INTEGER := 0; v_labels TEXT[]; v_texts TEXT[]; v_count INTEGER;
BEGIN
 PERFORM public.require_mock_paid_access(p_user_id);
 IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Invalid mock items' USING ERRCODE = '22023'; END IF;
 IF jsonb_array_length(p_items) <> 50 THEN RAISE EXCEPTION 'Mock requires 50 questions' USING ERRCODE = '22023'; END IF;
 INSERT INTO public.mock_exam_sessions(user_id, question_count, deadline_at, allocation_notice)
 VALUES (p_user_id,50,clock_timestamp() + INTERVAL '120 minutes',p_allocation_notice) RETURNING id INTO v_id;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_ordinal := v_ordinal + 1;
  IF jsonb_typeof(v_item->'options') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Invalid mock snapshot' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(v_item->'options') NOT BETWEEN 2 AND 26 THEN
   RAISE EXCEPTION 'Invalid mock options' USING ERRCODE = '22023'; END IF;
  v_labels := ARRAY[]::TEXT[];
  v_texts := ARRAY[]::TEXT[];
  FOR v_option IN SELECT value FROM jsonb_array_elements(v_item->'options') LOOP
   IF jsonb_typeof(v_option->'label') IS DISTINCT FROM 'string'
    OR jsonb_typeof(v_option->'text') IS DISTINCT FROM 'string'
    OR nullif(btrim(v_option->>'label'),'') IS NULL OR nullif(btrim(v_option->>'text'),'') IS NULL
    OR (v_option - 'label' - 'text') <> '{}'::jsonb OR (v_option->>'label') = ANY(v_labels)
    OR (v_option->>'text') = ANY(v_texts) THEN
    RAISE EXCEPTION 'Invalid mock option' USING ERRCODE = '22023'; END IF;
   v_labels := array_append(v_labels,v_option->>'label');
   v_texts := array_append(v_texts,v_option->>'text');
  END LOOP;
  -- Verify the immutable display snapshot against a current original PMLE question.
  SELECT count(*) INTO v_count FROM public.questions q JOIN public.exam_domains d ON d.id = q.domain_id
   WHERE q.id = (v_item->>'question_id')::uuid AND q.exam = 'GCP_PM_ML_ENG' AND q.status = 'ACTIVE'
    AND q.review_status = 'GOOD' AND q.parent_question_id IS NULL
    AND q.stem = v_item->>'stem' AND d.code = v_item->>'domain_code' AND d.name = v_item->>'domain_name'
    AND (SELECT count(*) FROM public.answers a WHERE a.question_id = q.id) = jsonb_array_length(v_item->'options')
    AND (SELECT count(*) FROM public.answers a WHERE a.question_id = q.id AND a.is_correct) = 1
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_item->'options') o WHERE
      (SELECT count(*) FROM public.answers a WHERE a.question_id = q.id AND a.choice_text = o->>'text') <> 1)
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_item->'options') o JOIN public.answers a ON a.question_id = q.id
      AND a.choice_text = o->>'text' AND a.is_correct WHERE o->>'label' = v_item->>'correct_label');
  IF v_count <> 1 THEN RAISE EXCEPTION 'Invalid mock snapshot' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.mock_exam_items(session_id,ordinal,question_id,domain_code,domain_name,stem,options,correct_label)
  VALUES(v_id,v_ordinal,(v_item->>'question_id')::uuid,v_item->>'domain_code',v_item->>'domain_name',v_item->>'stem',v_item->'options',v_item->>'correct_label');
 END LOOP;
 PERFORM public.require_mock_paid_access(p_user_id);
 RETURN v_id;
END;
$fn$;

-- All sensitive interactions serialize on the exam row. The wall clock is checked
-- AFTER lock acquisition, so a queued answer cannot sneak past the deadline.
-- Expiry commits scoring instead of raising (which would roll back auto-submit).
CREATE OR REPLACE FUNCTION public.interact_mock_exam(p_user_id UUID, p_session_id UUID, p_action TEXT,
 p_item_id UUID DEFAULT NULL, p_selected_label TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_session public.mock_exam_sessions%ROWTYPE; v_now TIMESTAMPTZ; v_count INTEGER;
BEGIN
 PERFORM public.require_mock_paid_access(p_user_id);
 IF p_action IS NULL OR p_action NOT IN ('read','answer','submit','results') THEN
  RAISE EXCEPTION 'Invalid mock action' USING ERRCODE = '22023'; END IF;
 SELECT * INTO v_session FROM public.mock_exam_sessions WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mock not found' USING ERRCODE = 'P0002'; END IF;
 PERFORM public.require_mock_paid_access(p_user_id);
 v_now := clock_timestamp();
 IF v_session.completed_at IS NULL THEN
  IF v_session.deadline_at <= v_now OR p_action = 'submit' THEN
   UPDATE public.mock_exam_items SET is_correct = coalesce(selected_label = correct_label,false) WHERE session_id = p_session_id;
   UPDATE public.mock_exam_sessions SET completed_at = least(v_now,deadline_at), timed_out = (deadline_at <= v_now)
    WHERE id = p_session_id RETURNING * INTO v_session;
  ELSIF p_action = 'answer' THEN
   IF p_selected_label IS NULL OR NOT EXISTS (SELECT 1 FROM public.mock_exam_items i,
    LATERAL jsonb_array_elements(i.options) o WHERE i.id = p_item_id AND i.session_id = p_session_id AND o->>'label' = p_selected_label) THEN
    RAISE EXCEPTION 'Invalid mock answer' USING ERRCODE = '22023'; END IF;
   -- A mock allows changing an answer before final submission, without feedback.
   UPDATE public.mock_exam_items SET selected_label = p_selected_label, answered_at = v_now
    WHERE id = p_item_id AND session_id = p_session_id;
  END IF;
 END IF;
 SELECT count(*) INTO v_count FROM public.mock_exam_items WHERE session_id = p_session_id AND answered_at IS NOT NULL;
 RETURN jsonb_build_object('id',v_session.id,'user_id',v_session.user_id,'question_count',v_session.question_count,
  'created_at',v_session.created_at,'deadline_at',v_session.deadline_at,'completed_at',v_session.completed_at,
  'timed_out',v_session.timed_out,'allocation_notice',v_session.allocation_notice,'server_now',clock_timestamp(),'answered_count',v_count);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.require_mock_paid_access(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_mock_exam(UUID,JSONB,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.interact_mock_exam(UUID,UUID,TEXT,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_mock_paid_access(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_mock_exam(UUID,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.interact_mock_exam(UUID,UUID,TEXT,UUID,TEXT) TO service_role;
COMMIT;
