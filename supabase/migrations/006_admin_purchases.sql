-- Protected purchase administration. No policies granting access to private finance.
begin;
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), admin_id uuid not null references auth.users(id),
 action text not null, object_id text not null, before_data jsonb, after_data jsonb,
 created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public,anon,authenticated;
grant select on public.audit_logs to authenticated;
create policy admin_audit_read on public.audit_logs for select to authenticated using(public.is_admin());
create policy admin_orders_read on public.orders for select to authenticated using(public.is_admin());
create policy admin_confirmations_read on public.payment_confirmations for select to authenticated using(public.is_admin());
create policy admin_entitlements_read on public.entitlements for select to authenticated using(public.is_admin());

create function public.admin_review_order(p_order_id uuid,p_decision text,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; original_status text; begins timestamptz; ends timestamptz; entitlement_id uuid;
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('paid','rejected') or p_note is null or length(p_note)>1000 or (p_decision='rejected' and length(btrim(p_note))=0) then
  raise exception 'Pilih keputusan dan isi catatan penolakan (maksimal 1.000 karakter).' using errcode='22023'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pesanan tidak ditemukan.' using errcode='22023'; end if;
 if o.status='paid' and p_decision='paid' then return jsonb_build_object('result','already_paid','order',to_jsonb(o)); end if;
 if o.status<>'submitted' then raise exception 'Hanya pesanan menunggu verifikasi yang dapat diperiksa.' using errcode='22023'; end if;
 original_status:=o.status;
 -- Serialize different orders for the same user too, so renewal durations never overlap.
 perform pg_advisory_xact_lock(hashtextextended(o.user_id::text,1));
 if p_decision='paid' and o.product_type<>'digital_tool' then
  if o.plan not in ('plus','pro') or o.duration_days is null or o.duration_days<1 then raise exception 'Snapshot paket tidak valid.' using errcode='22023'; end if;
  select greatest(now(),coalesce(max(x.until_at),now())) into begins from (
   select e.ends_at as until_at from public.entitlements e where e.user_id=o.user_id and e.plan=o.plan and e.ends_at>now()
   union all select s.expires_at from public.subscriptions s where s.user_id=o.user_id and s.plan=o.plan and s.status='active' and s.expires_at>now()
  ) x;
  ends:=begins+make_interval(days=>o.duration_days);
  insert into public.entitlements(user_id,plan,starts_at,ends_at,source_order_id) values(o.user_id,o.plan,begins,ends,o.id) returning id into entitlement_id;
 end if;
 update public.orders set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_note) where id=o.id returning * into o;
 insert into public.audit_logs(admin_id,action,object_id,before_data,after_data)
 values(auth.uid(),'order.'||p_decision,o.id::text,jsonb_build_object('status',original_status),jsonb_build_object('status',p_decision,'note',btrim(p_note),'entitlement_id',entitlement_id,'starts_at',begins,'ends_at',ends));
 return jsonb_build_object('result','reviewed','order',to_jsonb(o));
end $$;

create function public.admin_purchase_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
 select jsonb_build_object('users',(select count(*) from auth.users),'statuses',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.orders group by status) s),
 'verified_count',(select count(*) from public.orders where status='paid'),
 'subscription_revenue',(select coalesce(sum(total_rupiah),0) from public.orders where status='paid' and product_type<>'digital_tool'),
 'tools_revenue',(select coalesce(sum(total_rupiah),0) from public.orders where status='paid' and product_type='digital_tool'),
 'active_plans',(select count(distinct user_id) from (
  select user_id from public.entitlements where starts_at<=now() and ends_at>now()
  union select user_id from public.subscriptions where plan<>'free' and status='active' and expires_at>now()
 ) active_users)) into result;
 return result;
end $$;

create function public.admin_list_orders(p_search text default '',p_status text default '',p_product uuid default null,p_from date default null,p_to date default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
 if p_search is null or length(p_search)>120 or p_offset is null or p_offset<0 or p_status not in ('','pending','submitted','paid','rejected','expired') or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Filter tidak valid.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(row_data),'[]') into result from (
  select to_jsonb(o)||jsonb_build_object('buyer_name',coalesce(u.raw_user_meta_data->>'name',''),'buyer_email',u.email,
  'reference',c.reference,'confirmation_note',c.note,'proof_path',c.proof_path,
  'duplicate_reference',case when c.reference is null then false else exists(select 1 from public.payment_confirmations other where other.order_id<>o.id and lower(btrim(other.reference))=lower(btrim(c.reference))) end,
  'access_starts_at',e.starts_at,'access_ends_at',e.ends_at) as row_data
  from public.orders o join auth.users u on u.id=o.user_id
  left join public.payment_confirmations c on c.order_id=o.id left join public.entitlements e on e.source_order_id=o.id
  where (p_status='' or o.status=p_status) and (p_product is null or o.product_id=p_product)
   and (p_from is null or o.created_at >= (p_from::timestamp at time zone 'Asia/Jakarta'))
   and (p_to is null or o.created_at < ((p_to+1)::timestamp at time zone 'Asia/Jakarta'))
   and (p_search='' or position(lower(p_search) in lower(o.order_number||' '||o.product_name||' '||coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'name','')))>0)
  order by o.created_at desc,o.id limit 50 offset p_offset
 ) rows;
 return result;
end $$;
-- Only display names from Auth are included. No reads of profiles/transactions/budgets/goals.
revoke all on function public.admin_review_order(uuid,text,text),public.admin_purchase_summary(),public.admin_list_orders(text,text,uuid,date,date,integer) from public,anon;
grant execute on function public.admin_review_order(uuid,text,text),public.admin_purchase_summary(),public.admin_list_orders(text,text,uuid,date,date,integer) to authenticated;
notify pgrst,'reload schema';
commit;
