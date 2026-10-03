begin;
create table public.recurring_rules (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 amount bigint not null check(amount between 1 and 1000000000000), type text not null check(type in ('income','expense')),
 category text not null check(category in ('Makan & minum','Transportasi','Belanja','Tagihan','Kesehatan','Hiburan','Lainnya','Project','Gaji')),
 description text not null default '' check(length(description)<=160), frequency text not null check(frequency in ('weekly','monthly')),
 starts_on date not null check(starts_on between date '2000-01-01' and date '2100-12-31'), ends_on date,
 active boolean not null default true, next_on date not null, check(ends_on is null or ends_on>=starts_on)
);
-- Ledger survives rule/transaction deletion, so a due date cannot be generated twice.
create table public.recurring_occurrences (
 rule_id uuid not null, due_on date not null, user_id uuid not null references auth.users(id) on delete cascade,
 transaction_id uuid not null, primary key(rule_id,due_on), unique(transaction_id)
);
alter table public.recurring_rules enable row level security;
alter table public.recurring_occurrences enable row level security;
revoke all on public.recurring_rules,public.recurring_occurrences from public,anon,authenticated;
grant select on public.recurring_rules,public.recurring_occurrences to authenticated;
create policy own_recurring on public.recurring_rules for select to authenticated using(user_id=auth.uid() and public.get_effective_plan() in ('plus','pro'));
create policy own_occurrences on public.recurring_occurrences for select to authenticated using(user_id=auth.uid());
-- Scheduling anchors monthly dates to starts_on, never the clamped February date.
create function public.recurring_next(anchor date,frequency text,after_on date) returns date language sql immutable set search_path='' as $$
 select case when frequency='weekly' then after_on+7 else
 (date_trunc('month',after_on::timestamp)+interval '1 month')::date +
 (least(extract(day from anchor)::int,extract(day from date_trunc('month',after_on::timestamp)+interval '2 months - 1 day')::int)-1) end
$$;
create function public.save_recurring(p_id uuid,p_amount bigint,p_type text,p_category text,p_description text,p_frequency text,p_start date,p_end date,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.recurring_rules; today date:=(now() at time zone 'Asia/Jakarta')::date; target uuid;
begin
 if auth.uid() is null or public.get_effective_plan() not in ('plus','pro') then raise exception 'Plus aktif diperlukan' using errcode='42501'; end if;
 if p_start is null or p_start<date '2000-01-01' or p_start>date '2100-12-31' or p_frequency is null or p_frequency not in ('weekly','monthly') then raise exception 'Jadwal tidak valid' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if p_id is null then
  insert into public.recurring_rules(user_id,amount,type,category,description,frequency,starts_on,ends_on,active,next_on)
  values(auth.uid(),p_amount,p_type,p_category,p_description,p_frequency,p_start,p_end,p_active,p_start) returning id into target;
 else
  select * into r from public.recurring_rules where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Aturan tidak ditemukan' using errcode='42501'; end if;
  -- Schedule edits begin in the future; old occurrences are never changed/replayed.
  if r.starts_on<>p_start or r.frequency<>p_frequency or (not r.active and p_active) then
   r.next_on:=p_start;
   while r.next_on<=today loop r.next_on:=public.recurring_next(p_start,p_frequency,r.next_on); end loop;
  end if;
  update public.recurring_rules set amount=p_amount,type=p_type,category=p_category,description=p_description,
   frequency=p_frequency,starts_on=p_start,ends_on=p_end,active=p_active,next_on=r.next_on where id=p_id returning id into target;
 end if;
 return target;
end $$;
create function public.delete_recurring(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.get_effective_plan() not in ('plus','pro') then raise exception 'Plus aktif diperlukan' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 delete from public.recurring_rules where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Aturan tidak ditemukan' using errcode='42501'; end if;
end $$;
create function public.apply_recurring() returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.recurring_rules; due date; tx uuid; made integer:=0; today date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 if auth.uid() is null or public.get_effective_plan() not in ('plus','pro') then raise exception 'Plus aktif diperlukan' using errcode='42501'; end if;
 -- Same lock order as quota triggers. Parallel requests serialize per owner.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 for r in select * from public.recurring_rules where user_id=auth.uid() and active and next_on<=today order by next_on,id for update loop
  due:=r.next_on;
  while due<=today and (r.ends_on is null or due<=r.ends_on) and made<500 loop
   tx:=gen_random_uuid();
   insert into public.recurring_occurrences(rule_id,due_on,user_id,transaction_id) values(r.id,due,auth.uid(),tx) on conflict do nothing;
   if found then
    insert into public.transactions(id,user_id,data) values(tx,auth.uid(),jsonb_build_object('amount',r.amount,'type',r.type,'category',r.category,'description',r.description,'date',due::text));
    made:=made+1;
   end if;
   due:=public.recurring_next(r.starts_on,r.frequency,due);
  end loop;
  update public.recurring_rules set next_on=due where id=r.id;
  exit when made>=500;
 end loop;
 return jsonb_build_object('created',made,'more',exists(select 1 from public.recurring_rules where user_id=auth.uid() and active and next_on<=today and (ends_on is null or next_on<=ends_on)));
end $$;
revoke all on function public.recurring_next(date,text,date),public.save_recurring(uuid,bigint,text,text,text,text,date,date,boolean),public.delete_recurring(uuid),public.apply_recurring() from public,anon;
grant execute on function public.recurring_next(date,text,date),public.save_recurring(uuid,bigint,text,text,text,text,date,date,boolean),public.delete_recurring(uuid),public.apply_recurring() to authenticated;
commit;
