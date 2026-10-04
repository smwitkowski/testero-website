-- Run at v2 cutover, AFTER v2 serves traffic (it reads these tables server-side via service_role).
-- Removes the interim read-only access added on 2026-10-04 so the OLD app could keep working
-- after the v2 baseline revoked browser-role access. Idempotent. No data changes.
BEGIN;
DO $lockdown$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['questions','answers','explanations','exam_domains'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS interim_old_app_read ON public.%I', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $lockdown$;
COMMIT;
