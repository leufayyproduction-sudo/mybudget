begin;
-- Failed logins have no verified admin identity. Existing purchase audit stays intact.
alter table public.audit_logs alter column admin_id drop not null;
create table if not exists public.admin_login_attempts (
 id uuid primary key default gen_random_uuid(), identity_hash text not null check(identity_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(), finished_at timestamptz,
 outcome text check(outcome in('success','failed'))
);
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from public,anon,authenticated;
create index if not exists admin_login_identity_time on public.admin_login_attempts(identity_hash,created_at);
create index if not exists admin_login_created_time on public.admin_login_attempts(created_at);
create or replace function public.begin_admin_login(p_identity_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare attempt uuid;
begin
 if p_identity_hash is null or p_identity_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid attempt' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_identity_hash,14));
 delete from public.admin_login_attempts where created_at<now()-interval '7 days';
 if (select count(*) from public.admin_login_attempts where identity_hash=p_identity_hash and created_at>now()-interval '15 minutes')>=5 then
  if not exists(select 1 from public.audit_logs where action='admin.login.failed' and object_id=p_identity_hash and created_at>now()-interval '15 minutes') then
   insert into public.audit_logs(admin_id,action,object_id,after_data) values(null,'admin.login.failed',p_identity_hash,jsonb_build_object('outcome','failed','reason','rate_limited'));
  end if;
  return jsonb_build_object('allowed',false);
 end if;
 insert into public.admin_login_attempts(identity_hash) values(p_identity_hash) returning id into attempt;
 return jsonb_build_object('allowed',true,'attempt_id',attempt);
end $$;
create or replace function public.finish_admin_login(p_attempt_id uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$
declare attempt public.admin_login_attempts;actor uuid;
begin
 select * into attempt from public.admin_login_attempts where id=p_attempt_id for update;
 if not found or attempt.created_at<now()-interval '15 minutes' or p_success is null then raise exception 'Invalid attempt' using errcode='22023';end if;
 if p_success then
  if not public.is_admin() or not exists(select 1 from auth.users u where u.id=auth.uid() and encode(sha256(convert_to(lower(btrim(u.email)),'UTF8')),'hex')=attempt.identity_hash) then
   raise exception 'Akses ditolak' using errcode='42501';
  end if;
  actor:=auth.uid();
 end if;
 if attempt.finished_at is not null then return;end if;
 update public.admin_login_attempts set finished_at=now(),outcome=case when p_success then 'success' else 'failed' end where id=attempt.id;
 insert into public.audit_logs(admin_id,action,object_id,after_data)
 values(actor,case when p_success then 'admin.login.success' else 'admin.login.failed' end,attempt.id::text,jsonb_build_object('outcome',case when p_success then 'success' else 'failed' end));
end $$;
revoke all on function public.begin_admin_login(text),public.finish_admin_login(uuid,boolean) from public;
-- Anonymous failure reports need the random, unlisted attempt capability.
-- They are attempt telemetry, not proof of identity. Success always requires verified admin JWT.
grant execute on function public.begin_admin_login(text),public.finish_admin_login(uuid,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
