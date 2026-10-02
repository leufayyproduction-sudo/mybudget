-- Packages only. No checkout, payment or user-editable subscription writes.
begin;
create table public.plans (
 code text primary key check (code in ('free','plus','pro')),
 name text not null,
 price_rupiah integer not null check (price_rupiah >= 0),
 duration_days integer,
 transactions_limit integer check (transactions_limit > 0),
 categories_limit integer check (categories_limit > 0),
 goals_limit integer check (goals_limit > 0),
 budgets_limit integer check (budgets_limit > 0),
 reports_access boolean not null default false
);
insert into public.plans values
 ('free','Free',0,null,50,8,1,5,false),
 ('plus','Plus',9900,30,null,null,null,null,true),
 ('pro','Pro',19900,30,null,null,null,null,true);
create table public.subscriptions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'free' references public.plans(code),
 status text not null default 'active' check (status in ('active','cancelled','expired')),
 expires_at timestamptz,
 updated_at timestamptz not null default now(),
 constraint paid_subscription_expires check (plan='free' or expires_at is not null)
);
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
revoke all on public.plans,public.subscriptions from public,anon,authenticated;
grant select on public.plans to anon,authenticated;
grant select on public.subscriptions to authenticated;
create policy public_plan_catalog on public.plans for select to anon,authenticated using (true);
create policy own_subscription_read on public.subscriptions for select to authenticated using (user_id=(select auth.uid()));
-- Existing users and future registrations start Free. No metadata is consulted.
insert into public.subscriptions(user_id) select id from auth.users on conflict do nothing;
create function public.initialize_free_subscription() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.subscriptions(user_id) values(new.id) on conflict do nothing;
 return new;
end $$;
revoke all on function public.initialize_free_subscription() from public,anon,authenticated;
create trigger initialize_free_subscription after insert on auth.users for each row execute function public.initialize_free_subscription();

-- One source of truth. No user_id argument: callers can only ask about themselves.
-- Expiry is evaluated on every call, so no cron or mutation is required.
create function public.get_entitlement() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.subscriptions; p public.plans;
begin
 if auth.uid() is null then raise exception 'Login diperlukan.' using errcode='42501'; end if;
 select * into s from public.subscriptions where user_id=auth.uid();
 select * into p from public.plans where code=case when s.status='active' and s.plan<>'free' and s.expires_at>now() then s.plan else 'free' end;
 return jsonb_build_object('plan',p.code,'name',p.name,'status',case when p.code<>'free' then 'active' else 'free' end,
  'expires_at',case when p.code<>'free' then s.expires_at else null end,'reports_access',p.reports_access,
  'transactions_limit',p.transactions_limit,'categories_limit',p.categories_limit,'goals_limit',p.goals_limit,'budgets_limit',p.budgets_limit);
end $$;
revoke all on function public.get_entitlement() from public,anon;
grant execute on function public.get_entitlement() to authenticated;

-- Quotas serialize writes for one user, including simultaneous requests.
-- Existing rows above a limit remain readable/editable in the same quota bucket.
create function public.enforce_plan_limits() returns trigger language plpgsql set search_path='' as $$
declare e jsonb; lim integer; used integer; growing boolean:=true; bucket text; prior jsonb;
begin
 if auth.uid() is null or auth.uid()<>new.user_id then raise exception 'Akses ditolak.' using errcode='42501'; end if;
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Pemilik tidak dapat diubah.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 e:=public.get_entitlement();
 -- PostgREST upsert executes BEFORE INSERT before resolving an existing ID.
 -- Recognize that row too, so legacy edits above the cap continue to work.
 if tg_op='UPDATE' and tg_table_name<>'categories' then prior:=old.data;
 elsif tg_op='INSERT' then
  if tg_table_name='transactions' then select data into prior from public.transactions where id=new.id and user_id=new.user_id;
  elsif tg_table_name='goals' then select data into prior from public.goals where id=new.id and user_id=new.user_id;
  elsif tg_table_name='budgets' then select data into prior from public.budgets where id=new.id and user_id=new.user_id;
  end if;
 end if;
 if tg_table_name='transactions' then
  lim:=(e->>'transactions_limit')::integer; bucket:=left(new.data->>'date',7);
  if prior is not null then growing:=left(prior->>'date',7) is distinct from bucket; end if;
  select count(*) into used from public.transactions where user_id=new.user_id and id<>new.id and left(data->>'date',7)=bucket;
 elsif tg_table_name='categories' then
  lim:=(e->>'categories_limit')::integer; growing:=tg_op='INSERT' and not exists(select 1 from public.categories where id=new.id and user_id=new.user_id);
  select count(*) into used from public.categories where user_id=new.user_id and id<>new.id;
 elsif tg_table_name='goals' then
  lim:=(e->>'goals_limit')::integer;
  growing:=(new.data->>'saved')::numeric<(new.data->>'target')::numeric;
  if prior is not null and (prior->>'saved')::numeric<(prior->>'target')::numeric then growing:=false; end if;
  select count(*) into used from public.goals where user_id=new.user_id and id<>new.id and (data->>'saved')::numeric<(data->>'target')::numeric;
 elsif tg_table_name='budgets' then
  lim:=(e->>'budgets_limit')::integer; bucket:=new.data->>'month';
  if prior is not null then growing:=(prior->>'month',prior->>'category') is distinct from (bucket,new.data->>'category'); end if;
  if exists(select 1 from public.budgets where user_id=new.user_id and id<>new.id and data->>'month'=bucket and data->>'category'=new.data->>'category') then growing:=false; end if;
  select count(distinct data->>'category') into used from public.budgets where user_id=new.user_id and id<>new.id and data->>'month'=bucket;
 end if;
 if growing and lim is not null and used>=lim then
  raise exception 'Batas Free tercapai (%: %). Upgrade ke Premium untuk menambah data. Data lama tetap tersimpan.',tg_table_name,lim using errcode='P0001',hint='PLAN_LIMIT';
 end if;
 return new;
end $$;
revoke all on function public.enforce_plan_limits() from public,anon,authenticated;
create trigger enforce_transactions_plan before insert or update on public.transactions for each row execute function public.enforce_plan_limits();
create trigger enforce_categories_plan before insert or update on public.categories for each row execute function public.enforce_plan_limits();
create trigger enforce_goals_plan before insert or update on public.goals for each row execute function public.enforce_plan_limits();
create trigger enforce_budgets_plan before insert or update on public.budgets for each row execute function public.enforce_plan_limits();

-- Premium report input is only obtainable through this gated RPC in the app.
-- SECURITY INVOKER retains Phase 1 RLS. There is no owner/user argument.
create function public.get_report_transactions(p_month text) returns table(id uuid,data jsonb)
language plpgsql security invoker set search_path='' as $$
declare start_date date;
begin
 if not (public.get_entitlement()->>'reports_access')::boolean then raise exception 'Laporan tersedia untuk Premium aktif. Upgrade ke Premium.' using errcode='42501'; end if;
 if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Bulan tidak valid.' using errcode='22023'; end if;
 start_date:=(p_month||'-01')::date;
 return query select t.id,t.data from public.transactions t where t.user_id=auth.uid()
  and (t.data->>'date')::date >= (start_date-interval '5 months')::date
  and (t.data->>'date')::date < (start_date+interval '1 month')::date order by t.data->>'date',t.id;
end $$;
revoke all on function public.get_report_transactions(text) from public,anon;
grant execute on function public.get_report_transactions(text) to authenticated;
notify pgrst,'reload schema';
commit;
