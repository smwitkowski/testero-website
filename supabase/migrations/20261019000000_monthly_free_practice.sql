-- D-039: reserve questions atomically at session creation, per UTC calendar month.
BEGIN;
ALTER TABLE public.free_practice_quota RENAME COLUMN week_start TO month_start;
ALTER TABLE public.free_practice_quota DROP CONSTRAINT free_practice_quota_questions_used_check;
-- Preserve prior weekly usage in its UTC month instead of granting a fresh allowance.
CREATE TEMP TABLE monthly_practice_usage ON COMMIT DROP AS
 SELECT user_id, date_trunc('month', month_start)::date AS month_start,
        sum(questions_used)::integer AS questions_used
 FROM public.free_practice_quota GROUP BY 1, 2;
DELETE FROM public.free_practice_quota;
INSERT INTO public.free_practice_quota SELECT * FROM monthly_practice_usage;
ALTER TABLE public.free_practice_quota ADD CONSTRAINT free_practice_quota_questions_used_check CHECK (questions_used BETWEEN 0 AND 60);
ALTER TABLE public.free_practice_quota ADD CONSTRAINT free_practice_quota_month_start_check CHECK (extract(day FROM month_start) = 1);

CREATE OR REPLACE FUNCTION public.v2_consume_free_practice_quota(p_user_id UUID, p_question_count INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE v_month DATE := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
BEGIN
 IF p_user_id IS NULL OR p_question_count IS NULL OR p_question_count NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid quota arguments' USING ERRCODE = '22023';
 END IF;
 IF p_question_count > 60 THEN
  RAISE EXCEPTION 'Free practice quota exceeded' USING ERRCODE = 'P0001';
 END IF;
 INSERT INTO public.free_practice_quota (user_id, month_start, questions_used)
 VALUES (p_user_id, v_month, p_question_count)
 ON CONFLICT (user_id, month_start) DO UPDATE
 SET questions_used = public.free_practice_quota.questions_used + EXCLUDED.questions_used
 WHERE public.free_practice_quota.questions_used + EXCLUDED.questions_used <= 60;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Free practice quota exceeded' USING ERRCODE = 'P0001';
 END IF;
END;
$fn$;

COMMIT;
