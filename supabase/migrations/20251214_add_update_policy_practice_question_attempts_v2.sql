-- Allow authenticated users to update their own practice attempts.
-- Required for UPSERT on (user_id, question_id) in /api/questions/submit.

alter table public.practice_question_attempts_v2 enable row level security;

drop policy if exists "practice_question_attempts_v2_update_own" on public.practice_question_attempts_v2;

create policy "practice_question_attempts_v2_update_own"
  on public.practice_question_attempts_v2
  for update
  to public
  using (auth.role() = 'authenticated' and auth.uid() = user_id)
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);
