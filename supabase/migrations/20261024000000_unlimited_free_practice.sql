-- D-044: unlimited free practice. Keep all ownership, exam, snapshot and paid-variant checks.
-- Legacy quota rows/functions remain for rollback history, but creation never calls them.
BEGIN;
CREATE OR REPLACE FUNCTION public.v2_create_study_session(
 p_kind TEXT, p_user_id UUID, p_anonymous_owner_hash TEXT,
 p_items JSONB, p_expires_at TIMESTAMPTZ, p_free_only BOOLEAN,
 p_exam TEXT DEFAULT 'GCP_PM_ML_ENG'
) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
 v_session_id UUID;
 v_count INTEGER;
 v_item JSONB;
 v_option JSONB;
 v_ordinal INTEGER := 0;
 v_labels TEXT[];
 v_has_variants BOOLEAN;
BEGIN
 IF p_exam IS NULL OR p_free_only IS NULL OR p_kind IS NULL OR p_kind NOT IN ('diagnostic','practice')
 OR (p_user_id IS NULL) = (p_anonymous_owner_hash IS NULL)
 OR (p_anonymous_owner_hash IS NOT NULL AND p_anonymous_owner_hash !~ '^[0-9a-f]{64}$')
 OR (p_kind = 'practice' AND p_user_id IS NULL)
 OR p_expires_at IS NULL OR NOT isfinite(p_expires_at) OR p_expires_at <= now()
 OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
  RAISE EXCEPTION 'Invalid study session arguments' USING ERRCODE = '22023';
 END IF;
 v_count := jsonb_array_length(p_items);
 IF v_count NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid question count' USING ERRCODE = '22023';
 END IF;
 -- Reject cross-exam items even on legacy/default-PMLE aliases and practice paths.
 -- Missing question IDs also fail closed instead of bypassing the bank checks.
 IF EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_items) AS item
  LEFT JOIN public.questions q ON q.id = (item->>'question_id')::uuid
  WHERE q.id IS NULL OR q.exam IS DISTINCT FROM p_exam
 ) THEN
  RAISE EXCEPTION 'Study items must belong to the session exam' USING ERRCODE = '22023';
 END IF;
 IF p_exam <> 'GCP_PM_ML_ENG' THEN
  IF p_exam NOT IN ('data-engineer','cloud-architect','cloud-engineer','generative-ai-leader','agentic-architect')
   OR p_kind <> 'diagnostic' OR v_count NOT IN (5,10) THEN
   RAISE EXCEPTION 'Unsupported beta diagnostic exam, kind or length' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.questions q WHERE q.exam = p_exam
   AND q.status = 'ACTIVE' AND q.review_status = 'GOOD'
   AND q.parent_question_id IS NULL AND q.question_type = 'single_select') < 20 THEN
   RAISE EXCEPTION 'Beta diagnostic requires 20 approved live originals' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_items) AS item
   JOIN public.questions q ON q.id = (item->>'question_id')::uuid
   WHERE q.status IS DISTINCT FROM 'ACTIVE' OR q.review_status IS DISTINCT FROM 'GOOD'
    OR q.parent_question_id IS NOT NULL OR q.question_type IS DISTINCT FROM 'single_select'
  ) THEN
   RAISE EXCEPTION 'Beta diagnostic items must be approved live single-select originals' USING ERRCODE = '22023';
  END IF;
 END IF;
 -- Item snapshots are caller-provided. Resolve variant membership from the bank,
 -- not from snapshot fields, before creating a session or reserving free quota.
 SELECT EXISTS (
  SELECT 1 FROM jsonb_array_elements(p_items) AS item
  JOIN public.questions q ON q.id = (item->>'question_id')::uuid
  WHERE q.parent_question_id IS NOT NULL
 ) INTO v_has_variants;
 IF v_has_variants THEN
  IF p_kind = 'diagnostic' OR p_free_only THEN
   RAISE EXCEPTION 'Variants are only available in paid practice' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id AND status = 'active')
  AND NOT EXISTS (SELECT 1 FROM public.pmle_passes WHERE user_id = p_user_id AND refunded_at IS NULL AND expires_at > now()) THEN
   RAISE EXCEPTION 'Paid access required for variants' USING ERRCODE = '42501';
  END IF;
 END IF;
 -- D-044: all practice is unlimited. The free-only flag still rejects variants.
 -- Never reserve, read, or reset the legacy quota table on session creation.
 INSERT INTO public.study_sessions (kind,exam,user_id,anonymous_owner_hash,question_count,domain_codes,expires_at)
 VALUES (p_kind,p_exam,p_user_id,p_anonymous_owner_hash,v_count,
 ARRAY(SELECT DISTINCT value->>'domain_code' FROM jsonb_array_elements(p_items)),p_expires_at)
 RETURNING id INTO v_session_id;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  v_ordinal := v_ordinal + 1;
  IF jsonb_typeof(v_item) <> 'object'
   OR nullif(v_item->>'question_id','') IS NULL OR nullif(v_item->>'domain_code','') IS NULL
   OR nullif(v_item->>'domain_name','') IS NULL OR nullif(v_item->>'stem','') IS NULL
   OR nullif(v_item->>'correct_label','') IS NULL
   OR jsonb_typeof(v_item->'options') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Invalid study item snapshot' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(v_item->'options') NOT BETWEEN 2 AND 6 THEN
   RAISE EXCEPTION 'Invalid option count' USING ERRCODE = '22023';
  END IF;
  v_labels := ARRAY[]::TEXT[];
  FOR v_option IN SELECT value FROM jsonb_array_elements(v_item->'options') LOOP
   IF jsonb_typeof(v_option) <> 'object'
    OR jsonb_typeof(v_option->'label') IS DISTINCT FROM 'string'
    OR jsonb_typeof(v_option->'text') IS DISTINCT FROM 'string'
    OR nullif(v_option->>'label','') IS NULL OR nullif(v_option->>'text','') IS NULL
    OR (v_option - 'label' - 'text') <> '{}'::jsonb
    OR (v_option->>'label') = ANY(v_labels) THEN
    RAISE EXCEPTION 'Invalid or duplicate option' USING ERRCODE = '22023';
   END IF;
   v_labels := array_append(v_labels,v_option->>'label');
  END LOOP;
  IF NOT (v_item->>'correct_label') = ANY(v_labels) THEN
   RAISE EXCEPTION 'Correct label is not an option' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.session_items (session_id,ordinal,question_id,domain_code,domain_name,stem,options,correct_label)
  VALUES (v_session_id,v_ordinal,(v_item->>'question_id')::uuid,v_item->>'domain_code',
   v_item->>'domain_name',v_item->>'stem',v_item->'options',v_item->>'correct_label');
 END LOOP;
 RETURN v_session_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.create_free_practice_session(
 p_user_id UUID, p_items JSONB, p_expires_at TIMESTAMPTZ
) RETURNS UUID LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
 SELECT public.v2_create_study_session('practice', p_user_id, NULL, p_items, p_expires_at, true, 'GCP_PM_ML_ENG');
$fn$;

REVOKE EXECUTE ON FUNCTION public.v2_create_study_session(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_create_study_session(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_free_practice_session(UUID, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_free_practice_session(UUID, JSONB, TIMESTAMPTZ) TO service_role;
-- All paid selection, including originals-only batches, rechecks access at creation.
CREATE OR REPLACE FUNCTION public.create_pass_practice_session(
 p_user_id UUID, p_items JSONB, p_expires_at TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_id UUID;
BEGIN
 IF p_user_id IS NULL THEN
  RAISE EXCEPTION 'Invalid practice owner' USING ERRCODE = '22023';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id AND status = 'active')
 AND NOT EXISTS (SELECT 1 FROM public.pmle_passes WHERE user_id = p_user_id AND refunded_at IS NULL
  AND paid_at <= clock_timestamp() AND expires_at > clock_timestamp()) THEN
  RAISE EXCEPTION 'Paid practice access required' USING ERRCODE = '42501';
 END IF;
 v_id := public.v2_create_study_session('practice', p_user_id, NULL, p_items, p_expires_at, false, 'GCP_PM_ML_ENG');
 -- Include time spent inserting snapshots. Exceptions roll back the entire session.
 IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id AND status = 'active')
 AND NOT EXISTS (SELECT 1 FROM public.pmle_passes WHERE user_id = p_user_id AND refunded_at IS NULL
  AND paid_at <= clock_timestamp() AND expires_at > clock_timestamp()) THEN
  RAISE EXCEPTION 'Paid practice access required' USING ERRCODE = '42501';
 END IF;
 RETURN v_id;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.create_pass_practice_session(UUID, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pass_practice_session(UUID, JSONB, TIMESTAMPTZ) TO service_role;
COMMIT;
