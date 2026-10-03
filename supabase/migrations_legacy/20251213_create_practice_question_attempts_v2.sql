-- Create practice_question_attempts_v2 table for tracking canonical UUID question attempts
-- This replaces the legacy practice_attempts table's bigint question_id limitation
-- and enables proper "no-repeat-until-exhausted" question rotation

create table if not exists public.practice_question_attempts_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_label text null,
  is_correct boolean null,
  attempted_at timestamptz not null default now()
);

-- Unique constraint ensures "seen once" semantics per user
create unique index if not exists practice_question_attempts_v2_user_question_unique
  on public.practice_question_attempts_v2 (user_id, question_id);

-- Index for efficient "get all seen questions for user" queries
create index if not exists practice_question_attempts_v2_user_attempted_at_idx
  on public.practice_question_attempts_v2 (user_id, attempted_at desc);

-- Index for question-level analytics
create index if not exists practice_question_attempts_v2_question_id_idx
  on public.practice_question_attempts_v2 (question_id);

alter table public.practice_question_attempts_v2 enable row level security;

-- Users can insert their own attempts
create policy "practice_question_attempts_v2_insert_own"
  on public.practice_question_attempts_v2
  for insert
  to public
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

-- Users can select their own attempts
create policy "practice_question_attempts_v2_select_own"
  on public.practice_question_attempts_v2
  for select
  to public
  using (auth.role() = 'authenticated' and auth.uid() = user_id);

