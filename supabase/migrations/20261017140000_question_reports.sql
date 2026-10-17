-- Reports and contact details are visible only to the service role/coordinator.
create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null references public.study_sessions(id),
  item_id uuid not null references public.session_items(id),
  question_id uuid not null references public.questions(id),
  owner_key text not null,
  reason text not null check (reason in ('wrong answer','unclear','outdated','typo','other')),
  note text not null default '' check (length(note) <= 2000),
  email text not null default '' check (length(email) <= 254)
);
alter table public.question_reports enable row level security;
revoke all on public.question_reports from anon, authenticated;
grant select, insert on public.question_reports to service_role;
create index question_reports_owner_time on public.question_reports(owner_key,created_at);
create function public.submit_question_report(p_session_id uuid,p_item_id uuid,p_kind text,p_user_id uuid,p_anonymous_owner_hash text,p_reason text,p_note text,p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.study_sessions; q uuid; owner text;
begin
  select * into s from public.study_sessions where id=p_session_id and kind=p_kind;
  if not found or (s.completed_at is null and s.expires_at <= now()) then raise exception 'Question not found' using errcode='42501'; end if;
  if s.user_id is not null and s.anonymous_owner_hash is null and s.user_id=p_user_id then owner := 'user:'||s.user_id;
  elsif s.user_id is null and s.anonymous_owner_hash is not null and s.anonymous_owner_hash=p_anonymous_owner_hash then owner := 'anon:'||s.anonymous_owner_hash;
  else raise exception 'Question not found' using errcode='42501'; end if;
  select question_id into q from public.session_items where id=p_item_id and session_id=p_session_id;
  if not found or q is null then raise exception 'Question not found' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('question-report:'||owner,0));
  if (select count(*) from public.question_reports where owner_key=owner and created_at>now()-interval '1 hour') >= 10 then
    raise exception 'Report limit exceeded' using errcode='P0001';
  end if;
  insert into public.question_reports(session_id,item_id,question_id,owner_key,reason,note,email)
    values(p_session_id,p_item_id,q,owner,p_reason,p_note,p_email);
end;
$$;
revoke all on function public.submit_question_report(uuid,uuid,text,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_question_report(uuid,uuid,text,uuid,text,text,text,text) to service_role;
