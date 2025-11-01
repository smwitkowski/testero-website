create table if not exists public.practice_attempts (
  id bigserial primary key,
  user_id uuid not null,
  question_id bigint not null,
  selected_label char(1) not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  time_spent_seconds int null,
  topic text null,
  difficulty smallint null
);

-- Optional FK for cascading cleanup (kept optional per AC)
-- alter table public.practice_attempts
--   add constraint practice_attempts_user_fk
--   foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.practice_attempts enable row level security;

create policy "practice_attempts_insert_own"
  on public.practice_attempts
  for insert
  to public
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create policy "practice_attempts_select_own"
  on public.practice_attempts
  for select
  to public
  using (auth.role() = 'authenticated' and auth.uid() = user_id);

-- Indexes for dashboard queries
create index if not exists practice_attempts_user_answered_at_idx
  on public.practice_attempts (user_id, answered_at desc);

create index if not exists practice_attempts_question_id_idx
  on public.practice_attempts (question_id);

