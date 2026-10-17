-- Transactional results only. Never exposed to browser database roles.
CREATE TABLE public.results_email_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
 email text NOT NULL CHECK (email = lower(trim(email)) AND length(email) BETWEEN 3 AND 254),
 consent boolean NOT NULL CHECK (consent),
 consent_version text NOT NULL DEFAULT 'results-one-email-v1',
 created_at timestamptz NOT NULL DEFAULT now(),
 payload text NOT NULL,
 sent_at timestamptz,
 lease_token uuid,
 lease_until timestamptz,
 UNIQUE(session_id,email)
);
CREATE INDEX results_email_requests_email_created ON public.results_email_requests(email,created_at);
ALTER TABLE public.results_email_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.results_email_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.results_email_requests TO service_role;

CREATE FUNCTION public.claim_results_email(p_session_id uuid, p_email text, p_payload text, p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.results_email_requests;
BEGIN
 -- Serialize admission caps across sessions/addresses as well as duplicate claims.
 PERFORM pg_advisory_xact_lock(172038);
 IF NOT EXISTS (SELECT 1 FROM public.study_sessions WHERE id=p_session_id AND kind='diagnostic' AND completed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Completed diagnostic required' USING ERRCODE='22023';
 END IF;
 SELECT * INTO r FROM public.results_email_requests WHERE session_id=p_session_id AND email=p_email FOR UPDATE;
 IF NOT FOUND THEN
  IF (SELECT count(*) FROM public.results_email_requests WHERE session_id=p_session_id) >= 3 OR
     (SELECT count(*) FROM public.results_email_requests WHERE email=p_email AND created_at > now()-interval '1 day') >= 5 THEN
   RETURN jsonb_build_object('status','limited');
  END IF;
  INSERT INTO public.results_email_requests(session_id,email,consent,payload)
   VALUES(p_session_id,p_email,true,p_payload) RETURNING * INTO r;
 END IF;
 IF r.sent_at IS NOT NULL THEN RETURN jsonb_build_object('status','sent'); END IF;
 -- Resend retains idempotency keys for 24h. Never retry beyond that boundary.
 IF r.created_at <= now()-interval '23 hours' THEN RETURN jsonb_build_object('status','expired'); END IF;
 IF r.lease_until > now() THEN RETURN jsonb_build_object('status','busy'); END IF;
 UPDATE public.results_email_requests SET lease_token=p_lease,lease_until=now()+interval '1 minute' WHERE id=r.id;
 RETURN jsonb_build_object('status','claimed','id',r.id,'payload',r.payload);
END $$;
REVOKE ALL ON FUNCTION public.claim_results_email(uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_results_email(uuid,text,text,uuid) TO service_role;
