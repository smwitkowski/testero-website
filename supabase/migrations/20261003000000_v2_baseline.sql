-- Testero v2 additive baseline. Canonical content and legacy session rows stay intact.
-- Browser privileges are revoked even if an older permissive policy exists.
BEGIN;
CREATE TABLE IF NOT EXISTS public.exam_domains (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL, description TEXT
);
CREATE TABLE IF NOT EXISTS public.question_generation_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), exam TEXT NOT NULL, domain_code TEXT NOT NULL,
 target_count INT NOT NULL, generated_count INT NOT NULL DEFAULT 0, model TEXT NOT NULL,
 prompt_version TEXT, notes TEXT, created_by UUID REFERENCES auth.users(id),
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.questions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), exam TEXT NOT NULL,
 domain_id UUID NOT NULL REFERENCES public.exam_domains(id) ON DELETE RESTRICT,
 stem TEXT NOT NULL, difficulty TEXT CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
 source_ref TEXT, status TEXT CHECK (status IN ('ACTIVE','DRAFT','RETIRED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'UNREVIEWED'
 CHECK (review_status IN ('UNREVIEWED','GOOD','NEEDS_ANSWER_FIX','NEEDS_EXPLANATION_FIX','RETIRED'));
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS generation_run_id UUID REFERENCES public.question_generation_runs(id);
CREATE TABLE IF NOT EXISTS public.answers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
 choice_label TEXT NOT NULL, choice_text TEXT NOT NULL, is_correct BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS explanation_text TEXT;
CREATE TABLE IF NOT EXISTS public.explanations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), question_id UUID NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
 explanation_text TEXT NOT NULL, reasoning_style TEXT, doc_links JSONB
);
-- Legacy active subscriptions remain readable for the access rule; no new plans/trials.
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 stripe_customer_id TEXT NOT NULL UNIQUE, stripe_subscription_id TEXT UNIQUE,
 status TEXT NOT NULL, current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ,
 cancel_at_period_end BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.payment_history (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 stripe_payment_intent_id TEXT UNIQUE, amount INTEGER NOT NULL, currency TEXT NOT NULL,
 status TEXT NOT NULL, receipt_url TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.webhook_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stripe_event_id TEXT UNIQUE NOT NULL,
 type TEXT NOT NULL, processed BOOLEAN DEFAULT false, error TEXT,
 created_at TIMESTAMPTZ DEFAULT now(), processed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.study_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL CHECK (kind IN ('diagnostic','practice')),
 exam TEXT NOT NULL DEFAULT 'GCP_PM_ML_ENG', user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 anonymous_owner_hash TEXT CHECK (anonymous_owner_hash ~ '^[0-9a-f]{64}$'),
 question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 100),
 domain_codes TEXT[] NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL CHECK (isfinite(expires_at)), completed_at TIMESTAMPTZ,
 CONSTRAINT study_sessions_one_owner CHECK ((user_id IS NULL) <> (anonymous_owner_hash IS NULL)),
 CONSTRAINT study_sessions_valid_expiry CHECK (expires_at > created_at),
 CONSTRAINT study_sessions_practice_user CHECK (kind <> 'practice' OR user_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.session_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
 ordinal INTEGER NOT NULL CHECK (ordinal > 0), question_id UUID NOT NULL REFERENCES public.questions(id),
 domain_code TEXT NOT NULL, domain_name TEXT NOT NULL, stem TEXT NOT NULL,
 options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array'), correct_label TEXT NOT NULL,
 selected_label TEXT, is_correct BOOLEAN, answered_at TIMESTAMPTZ,
 UNIQUE(session_id, ordinal), UNIQUE(session_id, question_id),
 CONSTRAINT session_items_answer_state CHECK (
 (selected_label IS NULL AND is_correct IS NULL AND answered_at IS NULL) OR
 (selected_label IS NOT NULL AND is_correct IS NOT NULL AND answered_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.free_practice_quota (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 week_start DATE NOT NULL, questions_used INTEGER NOT NULL CHECK (questions_used BETWEEN 0 AND 5),
 PRIMARY KEY (user_id, week_start)
);
-- One-time PMLE Pass purchases. Apply through the normal migration process only.
CREATE TABLE IF NOT EXISTS public.pmle_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_checkout_session_id TEXT NOT NULL UNIQUE,
    stripe_payment_intent_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pmle_pass_expiry_after_payment CHECK (expires_at > paid_at)
);

CREATE INDEX IF NOT EXISTS idx_pmle_passes_user_expiry ON public.pmle_passes (user_id, expires_at DESC);

ALTER TABLE public.pmle_passes ENABLE ROW LEVEL SECURITY;

-- Match billing RLS: users may read their own rows, only service role may write.
-- No INSERT/UPDATE/DELETE policies. Checkout and refund webhooks use service role.


-- Durable refund tombstones survive refund-before-fulfillment delivery.
CREATE TABLE IF NOT EXISTS public.pmle_pass_refunds (
    stripe_payment_intent_id TEXT PRIMARY KEY,
    refunded_at TIMESTAMPTZ NOT NULL CHECK (isfinite(refunded_at))
);
ALTER TABLE public.pmle_pass_refunds ENABLE ROW LEVEL SECURITY;
-- No user policies: refund state is accessible only to the service role.
REVOKE ALL ON TABLE public.pmle_pass_refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pmle_pass_refunds TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pmle_passes TO service_role;

ALTER TABLE public.exam_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.exam_domains FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.exam_domains TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.questions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.questions TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.answers FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.answers TO service_role;
ALTER TABLE public.explanations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.explanations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.explanations TO service_role;
ALTER TABLE public.question_generation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.question_generation_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.question_generation_runs TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_subscriptions TO service_role;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_history TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.webhook_events TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.study_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.study_sessions TO service_role;
ALTER TABLE public.session_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.session_items FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.session_items TO service_role;
ALTER TABLE public.free_practice_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.free_practice_quota FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.free_practice_quota TO service_role;
ALTER TABLE public.pmle_passes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pmle_passes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pmle_passes TO service_role;
ALTER TABLE public.pmle_pass_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pmle_pass_refunds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pmle_pass_refunds TO service_role;
GRANT SELECT ON TABLE public.user_subscriptions TO authenticated;
DO $policy$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'v2_own_metadata') THEN
  CREATE POLICY v2_own_metadata ON public.user_subscriptions FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
 -- Restrictive policies are ANDed with every permissive policy, including legacy ones.
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'v2_owner_gate') THEN
  CREATE POLICY v2_owner_gate ON public.user_subscriptions AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
END $policy$;
GRANT SELECT ON TABLE public.payment_history TO authenticated;
DO $policy$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_history' AND policyname = 'v2_own_metadata') THEN
  CREATE POLICY v2_own_metadata ON public.payment_history FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
 -- Restrictive policies are ANDed with every permissive policy, including legacy ones.
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_history' AND policyname = 'v2_owner_gate') THEN
  CREATE POLICY v2_owner_gate ON public.payment_history AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
END $policy$;
GRANT SELECT ON TABLE public.study_sessions TO authenticated;
DO $policy$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'study_sessions' AND policyname = 'v2_own_metadata') THEN
  CREATE POLICY v2_own_metadata ON public.study_sessions FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
 -- Restrictive policies are ANDed with every permissive policy, including legacy ones.
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'study_sessions' AND policyname = 'v2_owner_gate') THEN
  CREATE POLICY v2_owner_gate ON public.study_sessions AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
END $policy$;
GRANT SELECT ON TABLE public.pmle_passes TO authenticated;
DO $policy$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pmle_passes' AND policyname = 'v2_own_metadata') THEN
  CREATE POLICY v2_own_metadata ON public.pmle_passes FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
 -- Restrictive policies are ANDed with every permissive policy, including legacy ones.
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pmle_passes' AND policyname = 'v2_owner_gate') THEN
  CREATE POLICY v2_owner_gate ON public.pmle_passes AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
END $policy$;
-- Quota remains server-only (no browser SELECT grant or permissive policy).
DO $policy$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'free_practice_quota' AND policyname = 'v2_owner_gate') THEN
  CREATE POLICY v2_owner_gate ON public.free_practice_quota AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
 END IF;
END $policy$;
CREATE INDEX IF NOT EXISTS questions_exam_idx ON public.questions (exam);
CREATE INDEX IF NOT EXISTS questions_domain_id_idx ON public.questions (domain_id);
CREATE INDEX IF NOT EXISTS questions_review_status_idx ON public.questions (review_status);
CREATE INDEX IF NOT EXISTS questions_generation_run_id_idx ON public.questions (generation_run_id);
CREATE INDEX IF NOT EXISTS answers_question_id_idx ON public.answers (question_id);
CREATE INDEX IF NOT EXISTS explanations_question_id_idx ON public.explanations (question_id);
CREATE INDEX IF NOT EXISTS question_generation_runs_exam_idx ON public.question_generation_runs (exam);
CREATE INDEX IF NOT EXISTS study_sessions_user_created_idx ON public.study_sessions (user_id, created_at DESC);
-- Refuse incompatible pre-existing function identities rather than replacing/dropping them.
-- CREATE OR REPLACE itself also rejects changed argument names and return types.
DO $identity$ DECLARE v_oid OID; BEGIN
 v_oid := to_regprocedure('public.fulfill_pmle_pass(uuid,text,text,text,timestamptz)');
 IF v_oid IS NOT NULL AND EXISTS (
  SELECT 1 FROM pg_proc WHERE oid = v_oid AND
   (proargnames IS DISTINCT FROM ARRAY['p_user_id','p_stripe_checkout_session_id','p_stripe_payment_intent_id','p_stripe_customer_id','p_paid_at']::text[]
    OR prorettype <> 'public.pmle_passes'::regtype OR NOT proretset)
 ) THEN RAISE EXCEPTION 'Incompatible fulfill_pmle_pass identity'; END IF;
 v_oid := to_regprocedure('public.refund_pmle_pass(text,timestamptz)');
 IF v_oid IS NOT NULL AND EXISTS (
  SELECT 1 FROM pg_proc WHERE oid = v_oid AND
   (proargnames IS DISTINCT FROM ARRAY['p_stripe_payment_intent_id','p_refunded_at']::text[]
    OR prorettype <> 'void'::regtype OR proretset)
 ) THEN RAISE EXCEPTION 'Incompatible refund_pmle_pass identity'; END IF;
END $identity$;

-- Both RPCs share a transaction-scoped lock on the payment intent. A refund
-- before insertion leaves a tombstone; a refund after insertion revokes the row.
CREATE OR REPLACE FUNCTION public.fulfill_pmle_pass(
    p_user_id UUID,
    p_stripe_checkout_session_id TEXT,
    p_stripe_payment_intent_id TEXT,
    p_stripe_customer_id TEXT,
    p_paid_at TIMESTAMPTZ
)
RETURNS SETOF public.pmle_passes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pass public.pmle_passes%ROWTYPE;
    v_refunded_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL
       OR p_stripe_checkout_session_id IS NULL OR p_stripe_checkout_session_id = ''
       OR p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id = ''
       OR p_stripe_customer_id IS NULL OR p_stripe_customer_id = ''
       OR p_paid_at IS NULL OR NOT isfinite(p_paid_at) THEN
        RAISE EXCEPTION 'Invalid PMLE pass fulfillment arguments' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_stripe_payment_intent_id, 0)
    );
    -- Hours, not calendar days, guarantee 90 * 24h across DST transitions.
    v_expires_at := p_paid_at + INTERVAL '2160 hours';
    SELECT refunded_at INTO v_refunded_at
        FROM public.pmle_pass_refunds
        WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;

    INSERT INTO public.pmle_passes (
        user_id, stripe_checkout_session_id, stripe_payment_intent_id,
        stripe_customer_id, paid_at, expires_at, refunded_at
    ) VALUES (
        p_user_id, p_stripe_checkout_session_id, p_stripe_payment_intent_id,
        p_stripe_customer_id, p_paid_at, v_expires_at, v_refunded_at
    ) ON CONFLICT (stripe_checkout_session_id) DO NOTHING;
    -- A different checkout using the same intent fails its UNIQUE constraint.
    -- Never overwrite a duplicate checkout's owner, paid date, or expiry.
    SELECT * INTO v_pass FROM public.pmle_passes
        WHERE stripe_checkout_session_id = p_stripe_checkout_session_id;
    IF NOT FOUND
       OR v_pass.user_id IS DISTINCT FROM p_user_id
       OR v_pass.stripe_payment_intent_id IS DISTINCT FROM p_stripe_payment_intent_id
       OR v_pass.stripe_customer_id IS DISTINCT FROM p_stripe_customer_id
       OR v_pass.paid_at IS DISTINCT FROM p_paid_at
       OR v_pass.expires_at IS DISTINCT FROM v_expires_at THEN
        RAISE EXCEPTION 'PMLE pass identity or paid date mismatch' USING ERRCODE = '22023';
    END IF;

    IF v_refunded_at IS NOT NULL THEN
        UPDATE public.pmle_passes
            SET refunded_at = LEAST(COALESCE(refunded_at, v_refunded_at), v_refunded_at)
            WHERE id = v_pass.id
            RETURNING * INTO v_pass;
    END IF;
    RETURN NEXT v_pass;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_pmle_pass(
    p_stripe_payment_intent_id TEXT,
    p_refunded_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_refunded_at TIMESTAMPTZ;
BEGIN
    IF p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id = ''
       OR p_refunded_at IS NULL OR NOT isfinite(p_refunded_at) THEN
        RAISE EXCEPTION 'Invalid PMLE pass refund arguments' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_stripe_payment_intent_id, 0)
    );
    INSERT INTO public.pmle_pass_refunds (stripe_payment_intent_id, refunded_at)
        VALUES (p_stripe_payment_intent_id, p_refunded_at)
        ON CONFLICT (stripe_payment_intent_id) DO UPDATE
        SET refunded_at = LEAST(public.pmle_pass_refunds.refunded_at, EXCLUDED.refunded_at)
        RETURNING refunded_at INTO v_refunded_at;
    UPDATE public.pmle_passes
        SET refunded_at = LEAST(COALESCE(refunded_at, v_refunded_at), v_refunded_at)
        WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;
END;
$$;

-- PostgreSQL grants PUBLIC execute by default: revoke it explicitly.
REVOKE EXECUTE ON FUNCTION public.fulfill_pmle_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_pmle_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
    TO service_role;
REVOKE EXECUTE ON FUNCTION public.refund_pmle_pass(TEXT, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_pmle_pass(TEXT, TIMESTAMPTZ)
    TO service_role;

-- Atomic UTC week quota. Active legacy status deliberately matches paid-access.ts.
CREATE OR REPLACE FUNCTION public.consume_free_practice_quota(p_user_id UUID, p_question_count INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_week DATE := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
BEGIN
 IF p_user_id IS NULL OR p_question_count IS NULL OR p_question_count NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid quota arguments' USING ERRCODE = '22023';
 END IF;
 IF EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id AND status = 'active')
 OR EXISTS (SELECT 1 FROM public.pmle_passes WHERE user_id = p_user_id AND refunded_at IS NULL AND expires_at > now()) THEN
  RETURN;
 END IF;
 IF p_question_count > 5 THEN
  RAISE EXCEPTION 'Free practice quota exceeded' USING ERRCODE = 'P0001';
 END IF;
 INSERT INTO public.free_practice_quota (user_id, week_start, questions_used)
 VALUES (p_user_id, v_week, p_question_count)
 ON CONFLICT (user_id, week_start) DO UPDATE
 SET questions_used = public.free_practice_quota.questions_used + EXCLUDED.questions_used
 WHERE public.free_practice_quota.questions_used + EXCLUDED.questions_used <= 5;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Free practice quota exceeded' USING ERRCODE = 'P0001';
 END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.create_study_session(
 p_kind TEXT, p_user_id UUID, p_anonymous_owner_hash TEXT,
 p_items JSONB, p_expires_at TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
 v_session_id UUID;
 v_count INTEGER;
 v_item JSONB;
 v_option JSONB;
 v_ordinal INTEGER := 0;
 v_labels TEXT[];
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('diagnostic','practice')
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
 IF p_kind = 'practice' THEN
  PERFORM public.consume_free_practice_quota(p_user_id, v_count);
 END IF;
 INSERT INTO public.study_sessions (kind,user_id,anonymous_owner_hash,question_count,domain_codes,expires_at)
 VALUES (p_kind,p_user_id,p_anonymous_owner_hash,v_count,
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

CREATE OR REPLACE FUNCTION public.answer_study_item(
 p_session_id UUID, p_item_id UUID, p_selected_label TEXT,
 p_user_id UUID DEFAULT NULL, p_anonymous_owner_hash TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
 v_session public.study_sessions%ROWTYPE;
 v_item public.session_items%ROWTYPE;
 v_next INTEGER;
 v_answered INTEGER;
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
 IF p_selected_label IS NULL OR NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(v_item.options) WHERE value->>'label' = p_selected_label
 ) THEN RAISE EXCEPTION 'Invalid selected label' USING ERRCODE = '22023'; END IF;
 IF v_item.answered_at IS NOT NULL THEN
  IF v_item.selected_label IS DISTINCT FROM p_selected_label THEN
   RAISE EXCEPTION 'Answer already recorded' USING ERRCODE = '22023';
  END IF;
 ELSE
  SELECT min(ordinal) INTO v_next FROM public.session_items WHERE session_id = p_session_id AND answered_at IS NULL;
  IF v_session.completed_at IS NOT NULL OR v_item.ordinal IS DISTINCT FROM v_next THEN
   RAISE EXCEPTION 'Answer the next item in order' USING ERRCODE = '22023';
  END IF;
  UPDATE public.session_items SET selected_label = p_selected_label,
   is_correct = (correct_label = p_selected_label), answered_at = now() WHERE id = p_item_id;
 END IF;
 SELECT count(*) INTO v_answered FROM public.session_items WHERE session_id = p_session_id AND answered_at IS NOT NULL;
 IF v_answered = v_session.question_count THEN
  UPDATE public.study_sessions SET completed_at = coalesce(completed_at,now()) WHERE id = p_session_id;
 END IF;
 RETURN jsonb_build_object('answeredCount',v_answered,'totalQuestions',v_session.question_count,
  'completed',v_answered = v_session.question_count);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.consume_free_practice_quota(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_free_practice_quota(UUID, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_study_session(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_study_session(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ) TO service_role;
REVOKE EXECUTE ON FUNCTION public.answer_study_item(UUID, UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.answer_study_item(UUID, UUID, TEXT, UUID, TEXT) TO service_role;
COMMIT;
