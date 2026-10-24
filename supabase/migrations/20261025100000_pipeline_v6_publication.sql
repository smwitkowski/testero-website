-- Pipeline v6 A: atomic, hash-bound publication and audited withdrawal.
BEGIN;
ALTER TABLE public.questions
 ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
 ADD COLUMN content_sha256 TEXT CHECK (content_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE public.questions DROP CONSTRAINT questions_review_status_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_review_status_check CHECK
 (review_status IN ('UNREVIEWED','GOOD','NEEDS_ANSWER_FIX','NEEDS_EXPLANATION_FIX','RETIRED','QUARANTINED'));

CREATE TABLE public.question_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK (revision > 0),
 at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), actor TEXT NOT NULL CHECK (btrim(actor) <> ''),
 action TEXT NOT NULL CHECK (action IN ('published','quarantined','restored','retired','reviewed','recouncil','report')),
 reason TEXT NOT NULL DEFAULT '', payload JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX question_events_question_time_idx ON public.question_events(question_id,at DESC);
CREATE INDEX question_events_action_time_idx ON public.question_events(action,at);
ALTER TABLE public.question_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.question_events TO service_role;

-- UTF8 byte lengths avoid separator collisions, including literal delimiters/newlines.
-- No trim/Unicode normalization. NULL explanations encode as empty for legacy rows.
CREATE FUNCTION public.question_content_frame(p_text TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT SET search_path = public, pg_temp AS $fn$
 SELECT octet_length(convert_to(p_text,'UTF8'))::text || ':' || p_text
$fn$;
CREATE FUNCTION public.question_content_sha256(p_question_id UUID) RETURNS TEXT
LANGUAGE SQL STABLE SET search_path = public, pg_temp AS $fn$
 SELECT CASE WHEN (SELECT count(*) FROM public.answers WHERE question_id=q.id AND is_correct) = 1
 THEN encode(sha256(convert_to('testero-content-v1|' || public.question_content_frame(q.stem) ||
  (SELECT public.question_content_frame(choice_text) || public.question_content_frame(coalesce(explanation_text,''))
   FROM public.answers WHERE question_id=q.id AND is_correct) ||
  public.question_content_frame((SELECT count(*)::text FROM public.answers WHERE question_id=q.id AND NOT is_correct)) ||
  coalesce((SELECT string_agg(public.question_content_frame(choice_text) || public.question_content_frame(coalesce(explanation_text,'')),''
    ORDER BY choice_text COLLATE "C",coalesce(explanation_text,'') COLLATE "C")
   FROM public.answers WHERE question_id=q.id AND NOT is_correct),''),'UTF8')),'hex') END
 FROM public.questions q WHERE q.id=p_question_id
$fn$;
UPDATE public.questions SET content_sha256=public.question_content_sha256(id);

-- Child writes serialize with publication on their parent, including new answer rows.
-- Otherwise locking existing answers alone would not protect against insert phantoms.
CREATE FUNCTION public.lock_question_answer_content() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_id UUID; v_question public.questions; v_changed BOOLEAN;
BEGIN
 -- Relabeling/reordering does not change the canonical content or revision.
 IF TG_OP = 'UPDATE' AND (NEW.question_id,NEW.choice_text,NEW.explanation_text,NEW.is_correct)
  IS NOT DISTINCT FROM (OLD.question_id,OLD.choice_text,OLD.explanation_text,OLD.is_correct) THEN
  RETURN NEW;
 END IF;
 FOR v_id IN SELECT DISTINCT id FROM unnest(ARRAY[
   CASE WHEN TG_OP <> 'INSERT' THEN OLD.question_id END,
   CASE WHEN TG_OP <> 'DELETE' THEN NEW.question_id END]) id WHERE id IS NOT NULL ORDER BY id LOOP
  SELECT * INTO v_question FROM public.questions WHERE id=v_id FOR UPDATE;
  IF NOT FOUND THEN CONTINUE; END IF; -- parent deletion cascade
  IF v_question.status = 'ACTIVE' THEN
   RAISE EXCEPTION 'Withdraw question before editing answers' USING ERRCODE='55000';
  END IF;
  -- Initial DRAFT answer inserts keep revision 1. Subsequent edits advance the
  -- revision and invalidate the cache. Hash authority always remains recomputation.
  v_changed := TG_OP <> 'INSERT' OR v_question.content_sha256 IS NOT NULL OR
    EXISTS (SELECT 1 FROM public.question_events WHERE question_id=v_id);
  IF v_changed THEN
   UPDATE public.questions SET revision=revision+1,content_sha256=NULL,updated_at=clock_timestamp() WHERE id=v_id;
  END IF;
 END LOOP;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$fn$;
CREATE TRIGGER question_answer_content_lock BEFORE INSERT OR UPDATE OR DELETE ON public.answers
 FOR EACH ROW EXECUTE FUNCTION public.lock_question_answer_content();
CREATE FUNCTION public.guard_active_question_content() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
 IF (NEW.stem,NEW.domain_id,NEW.exam,NEW.question_type,NEW.parent_question_id)
  IS DISTINCT FROM (OLD.stem,OLD.domain_id,OLD.exam,OLD.question_type,OLD.parent_question_id) THEN
  IF OLD.status = 'ACTIVE' THEN
   RAISE EXCEPTION 'Withdraw question before editing content' USING ERRCODE='55000';
  END IF;
  NEW.revision := OLD.revision+1;
  NEW.content_sha256 := NULL;
 END IF;
 RETURN NEW;
END;
$fn$;
CREATE TRIGGER question_active_content_guard BEFORE UPDATE ON public.questions
 FOR EACH ROW EXECUTE FUNCTION public.guard_active_question_content();

-- UPDATE authority is deliberately a trusted service boundary, not SQL proof of
-- council verdicts. The service role can set this GUC (or insert legacy ACTIVE
-- rows); browser roles cannot execute lifecycle RPCs or write bank rows.
CREATE FUNCTION public.guard_question_lifecycle() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
 IF (NEW.status,NEW.review_status) IS DISTINCT FROM (OLD.status,OLD.review_status)
 AND current_setting('testero.lifecycle',true) IS DISTINCT FROM '1' THEN
  RAISE EXCEPTION 'Use transition_question for lifecycle changes' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END;
$fn$;
CREATE TRIGGER question_lifecycle_guard BEFORE UPDATE ON public.questions
 FOR EACH ROW EXECUTE FUNCTION public.guard_question_lifecycle();

-- Global lifecycle fence, then domain, then rows. A family may span domains
-- (the parent FK does not restrict this). Serializing lifecycle transactions
-- prevents opposite original/variant calls from taking domain/row locks in
-- reverse order. Reports acquire their cap lock BEFORE this fence; lifecycle
-- code never acquires report locks. Content writers retain the row-lock fence.
-- The domain lock also prevents concurrent removals from breaking the floor.
CREATE FUNCTION public.lock_question_lifecycle(p_question_id UUID) RETURNS public.questions
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_domain UUID; v_question public.questions;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('question-lifecycle-global',0));
 SELECT domain_id INTO v_domain FROM public.questions WHERE id=p_question_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Question not found' USING ERRCODE='P0002'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('question-domain:' || v_domain::text,0));
 SELECT * INTO v_question FROM public.questions WHERE id=p_question_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Question not found' USING ERRCODE='P0002'; END IF;
 IF v_question.domain_id IS DISTINCT FROM v_domain THEN
  RAISE EXCEPTION 'Question domain changed; retry' USING ERRCODE='40001';
 END IF;
 RETURN v_question;
END;
$fn$;

CREATE FUNCTION public.transition_question(p_question_id UUID,p_action TEXT,p_expected_sha256 TEXT,
 p_actor TEXT,p_reason TEXT,p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_question public.questions; v_hash TEXT; v_action TEXT; v_outcome TEXT := 'changed';
 v_changed BOOLEAN := true; v_previous_flag TEXT; v_variant public.questions;
BEGIN
 IF p_actor IS NULL OR btrim(p_actor) = '' OR p_reason IS NULL OR p_payload IS NULL
 OR jsonb_typeof(p_payload) <> 'object' OR p_action IS NULL
 OR p_action NOT IN ('published','quarantined','restored','retired','reviewed') THEN
  RAISE EXCEPTION 'Invalid lifecycle arguments' USING ERRCODE='22023';
 END IF;
 v_question := public.lock_question_lifecycle(p_question_id);
 v_hash := public.question_content_sha256(p_question_id);
 IF (p_payload ? 'expected_revision' AND (p_payload->>'expected_revision')::integer IS DISTINCT FROM v_question.revision)
 OR (p_payload ? 'revision' AND (p_payload->>'revision')::integer IS DISTINCT FROM v_question.revision) THEN
  RAISE EXCEPTION 'Question revision changed' USING ERRCODE='55000';
 END IF;
 IF p_payload ? 'quarantine_event_id' AND (
  v_question.review_status <> 'QUARANTINED' OR v_question.status <> 'DRAFT' OR
  (p_payload->>'quarantine_event_id')::uuid IS DISTINCT FROM
    (SELECT id FROM public.question_events WHERE question_id=p_question_id AND action='quarantined'
     ORDER BY at DESC,id DESC LIMIT 1)
 ) THEN
  RAISE EXCEPTION 'Question quarantine cycle changed' USING ERRCODE='55000';
 END IF;
 -- Draft ingest finalization is NOT publication. Only the exact pending run
 -- and unchanged review receipt may finalize UNREVIEWED -> GOOD/failed. Neither
 -- quarantined nor previously finalized rows may use this path to escape their
 -- lifecycle. The browser cannot call the wrapper or this shared transition.
 IF p_action='reviewed' AND (
  v_question.status IS DISTINCT FROM 'DRAFT' OR v_question.review_status IS DISTINCT FROM 'UNREVIEWED'
  OR p_reason NOT IN ('GOOD','NEEDS_ANSWER_FIX')
  OR nullif(p_payload->>'generation_run_id','') IS NULL
  OR v_question.generation_run_id IS DISTINCT FROM (p_payload->>'generation_run_id')::uuid
  OR p_payload->>'review_notes' IS NULL
  OR v_question.review_notes IS DISTINCT FROM p_payload->>'review_notes'
 ) THEN
  RAISE EXCEPTION 'Question review finalization eligibility changed' USING ERRCODE='55000';
 END IF;
 -- Optional eligibility fences make legacy retirement safe against a concurrent
 -- publisher; the caller's earlier inventory query is not an atomic precondition.
 IF p_action = 'retired' AND (
   (p_payload ? 'expected_status' AND v_question.status IS DISTINCT FROM p_payload->>'expected_status') OR
   (p_payload ? 'expected_exam' AND v_question.exam IS DISTINCT FROM p_payload->>'expected_exam') OR
   (p_payload ? 'expected_created_before' AND (p_payload->>'expected_created_before' IS NULL OR
      v_question.created_at >= (p_payload->>'expected_created_before')::timestamptz))
 ) THEN
  RAISE EXCEPTION 'Question retirement eligibility changed' USING ERRCODE='55000';
 END IF;
 IF (p_action IN ('published','restored') AND p_expected_sha256 IS NULL)
 OR (p_expected_sha256 IS NOT NULL AND
    (p_expected_sha256 !~ '^[0-9a-f]{64}$' OR v_hash IS DISTINCT FROM p_expected_sha256)) THEN
  RAISE EXCEPTION 'Question content hash mismatch' USING ERRCODE='22023';
 END IF;
 IF p_action = 'published' AND v_question.parent_question_id IS NOT NULL THEN
  RAISE EXCEPTION 'Only original questions may publish' USING ERRCODE='55000';
 END IF;
 IF p_action = 'published' AND (v_question.status IS DISTINCT FROM 'DRAFT'
    OR v_question.review_status IS DISTINCT FROM 'GOOD') THEN
  RAISE EXCEPTION 'Only GOOD DRAFT questions may publish' USING ERRCODE='55000';
 ELSIF p_action = 'restored' AND (v_question.status IS DISTINCT FROM 'DRAFT'
    OR v_question.review_status IS DISTINCT FROM 'QUARANTINED') THEN
  RAISE EXCEPTION 'Only quarantined questions may restore' USING ERRCODE='55000';
 END IF;
 -- Restoring the original never restores variants. Each variant needs a fresh
 -- council/hash and an ACTIVE GOOD ancestry; otherwise it could bypass a still
 -- withdrawn original. The lifecycle-global fence serializes ancestry changes
 -- made by lifecycle RPCs; active content/parent edits are already forbidden.
 IF p_action='restored' AND v_question.parent_question_id IS NOT NULL AND EXISTS (
  WITH RECURSIVE ancestors AS (
   SELECT id,parent_question_id,status,review_status FROM public.questions WHERE id=v_question.parent_question_id
   UNION
   SELECT q.id,q.parent_question_id,q.status,q.review_status FROM public.questions q JOIN ancestors a ON q.id=a.parent_question_id
  ) SELECT 1 FROM ancestors WHERE status<>'ACTIVE' OR review_status<>'GOOD'
 ) THEN
  RAISE EXCEPTION 'Restore original ancestry before variant' USING ERRCODE='55000';
 END IF;
 IF p_action IN ('published','restored') OR (p_action='reviewed' AND p_reason='GOOD') THEN
  IF v_question.question_type <> 'single_select' OR nullif(btrim(v_question.stem),'') IS NULL
   OR (SELECT count(*) FROM public.answers WHERE question_id=p_question_id) <> 4
   OR (SELECT count(*) FROM public.answers WHERE question_id=p_question_id AND is_correct) <> 1
   OR (SELECT count(DISTINCT choice_text) FROM public.answers WHERE question_id=p_question_id) <> 4
   OR EXISTS (SELECT 1 FROM public.answers WHERE question_id=p_question_id AND
      (nullif(btrim(choice_text),'') IS NULL OR nullif(btrim(explanation_text),'') IS NULL)) THEN
   RAISE EXCEPTION 'Question fails publication integrity' USING ERRCODE='22023';
  END IF;
 ELSIF p_action = 'quarantined' AND v_question.status IS DISTINCT FROM 'ACTIVE' THEN
  v_changed := false; v_outcome := 'noop';
 ELSIF p_action = 'retired' AND v_question.status = 'RETIRED' THEN
  v_changed := false; v_outcome := 'noop';
 END IF;
 IF p_action IN ('quarantined','retired') AND v_question.status = 'ACTIVE'
 AND v_question.parent_question_id IS NULL AND
  (SELECT count(*) FROM public.questions WHERE domain_id=v_question.domain_id AND status='ACTIVE'
   AND review_status='GOOD' AND parent_question_id IS NULL AND id<>p_question_id) < 3 THEN
  v_changed := false; v_outcome := 'floor_blocked';
 END IF;
 IF v_changed THEN
  v_previous_flag := current_setting('testero.lifecycle',true);
  BEGIN
   PERFORM set_config('testero.lifecycle','1',true);
   UPDATE public.questions SET
    status=CASE WHEN p_action IN ('published','restored') THEN 'ACTIVE'
                WHEN p_action='reviewed' THEN 'DRAFT'
                WHEN p_action='quarantined' THEN 'DRAFT' ELSE 'RETIRED' END,
    review_status=CASE WHEN p_action IN ('published','restored') THEN 'GOOD'
                       WHEN p_action='reviewed' THEN p_reason
                       WHEN p_action='quarantined' THEN 'QUARANTINED' ELSE 'RETIRED' END,
    content_sha256=v_hash, updated_at=clock_timestamp() WHERE id=p_question_id;
   IF p_action IN ('quarantined','retired') THEN
    -- Descendants, not just immediate children: legacy data may contain nested
    -- variants or cross-exam/domain families. Only ACTIVE variants change. They
    -- never count toward the originals-only floor. A blocked parent withdrawal
    -- never enters this block. Every child has its own audit event, atomically.
    FOR v_variant IN
     WITH RECURSIVE family AS (
      SELECT id FROM public.questions WHERE parent_question_id=p_question_id
      UNION
      SELECT q.id FROM public.questions q JOIN family f ON q.parent_question_id=f.id
     ) SELECT q.* FROM public.questions q JOIN family f ON f.id=q.id
       WHERE q.status='ACTIVE' AND q.id<>p_question_id ORDER BY q.id FOR UPDATE OF q
    LOOP
     UPDATE public.questions SET
      status=CASE WHEN p_action='quarantined' THEN 'DRAFT' ELSE 'RETIRED' END,
      review_status=CASE WHEN p_action='quarantined' THEN 'QUARANTINED' ELSE 'RETIRED' END,
      content_sha256=public.question_content_sha256(id),updated_at=clock_timestamp()
     WHERE id=v_variant.id;
     INSERT INTO public.question_events(question_id,revision,actor,action,reason,payload)
     VALUES(v_variant.id,v_variant.revision,p_actor,p_action,p_reason,
      jsonb_build_object('outcome','changed','requested_action',p_action,
       'cascade_from_question_id',p_question_id,'content_sha256',public.question_content_sha256(v_variant.id)));
    END LOOP;
   END IF;
   PERFORM set_config('testero.lifecycle',coalesce(v_previous_flag,''),true);
  EXCEPTION WHEN OTHERS THEN
   PERFORM set_config('testero.lifecycle',coalesce(v_previous_flag,''),true);
   RAISE;
  END;
 END IF;
 v_action := CASE WHEN v_changed THEN p_action ELSE 'recouncil' END;
 INSERT INTO public.question_events(question_id,revision,actor,action,reason,payload)
 VALUES(p_question_id,v_question.revision,p_actor,v_action,p_reason,
  p_payload || jsonb_build_object('outcome',v_outcome,'requested_action',p_action,'content_sha256',v_hash));
 RETURN jsonb_build_object('question_id',p_question_id,'revision',v_question.revision,
   'content_sha256',v_hash,'changed',v_changed,'outcome',v_outcome);
END;
$fn$;
CREATE FUNCTION public.finalize_question_review(p_question_id UUID,p_generation_run_id UUID,
 p_review_status TEXT,p_review_notes TEXT) RETURNS JSONB
LANGUAGE SQL SET search_path = public, pg_temp AS $fn$
 SELECT public.transition_question(p_question_id,'reviewed',NULL,'pipeline-review',p_review_status,
  jsonb_build_object('generation_run_id',p_generation_run_id,'review_notes',p_review_notes))
$fn$;
CREATE FUNCTION public.publish_question(p_question_id UUID,p_expected_sha256 TEXT,p_actor TEXT,p_payload JSONB DEFAULT '{}')
RETURNS JSONB LANGUAGE SQL SET search_path = public, pg_temp AS $fn$
 SELECT public.transition_question(p_question_id,'published',p_expected_sha256,p_actor,'Council unanimous',p_payload)
$fn$;
CREATE FUNCTION public.quarantine_question(p_question_id UUID,p_reason TEXT,p_actor TEXT,p_payload JSONB DEFAULT '{}',p_expected_sha256 TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE SQL SET search_path = public, pg_temp AS $fn$
 SELECT public.transition_question(p_question_id,'quarantined',p_expected_sha256,p_actor,p_reason,p_payload)
$fn$;
CREATE FUNCTION public.restore_question(p_question_id UUID,p_expected_sha256 TEXT,p_actor TEXT,p_payload JSONB DEFAULT '{}')
RETURNS JSONB LANGUAGE SQL SET search_path = public, pg_temp AS $fn$
 SELECT public.transition_question(p_question_id,'restored',p_expected_sha256,p_actor,'Re-council unanimous',p_payload)
$fn$;
CREATE FUNCTION public.retire_question(p_question_id UUID,p_reason TEXT,p_actor TEXT,p_payload JSONB DEFAULT '{}',p_expected_sha256 TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE SQL SET search_path = public, pg_temp AS $fn$
 SELECT public.transition_question(p_question_id,'retired',p_expected_sha256,p_actor,p_reason,p_payload)
$fn$;
-- Invoker rights, hardened search paths, no browser-accessible lifecycle/helper RPC.
REVOKE ALL ON FUNCTION public.question_content_frame(TEXT),public.question_content_sha256(UUID),
 public.lock_question_answer_content(),public.guard_active_question_content(),public.guard_question_lifecycle(),public.lock_question_lifecycle(UUID),
 public.transition_question(UUID,TEXT,TEXT,TEXT,TEXT,JSONB),
 public.finalize_question_review(UUID,UUID,TEXT,TEXT),public.publish_question(UUID,TEXT,TEXT,JSONB),
 public.quarantine_question(UUID,TEXT,TEXT,JSONB,TEXT),public.restore_question(UUID,TEXT,TEXT,JSONB),
 public.retire_question(UUID,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.question_content_frame(TEXT),public.question_content_sha256(UUID),
 public.lock_question_lifecycle(UUID),public.transition_question(UUID,TEXT,TEXT,TEXT,TEXT,JSONB),
 public.finalize_question_review(UUID,UUID,TEXT,TEXT),public.publish_question(UUID,TEXT,TEXT,JSONB),public.quarantine_question(UUID,TEXT,TEXT,JSONB,TEXT),
 public.restore_question(UUID,TEXT,TEXT,JSONB),public.retire_question(UUID,TEXT,TEXT,JSONB,TEXT) TO service_role;
COMMIT;
