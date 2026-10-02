-- Session A: manual checkout. No payment provider, no automatic activation.
begin;
create table public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public,anon,authenticated;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.admin_users where user_id=auth.uid());
$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;

create table public.products (
 id uuid primary key default gen_random_uuid(), code text unique not null check(code ~ '^[a-z0-9_-]{2,60}$'),
 name text not null check(length(name) between 1 and 120),
 type text not null check(type in ('subscription','early_access','digital_tool')),
 price_rupiah integer not null check(price_rupiah between 1 and 1000000000),
 duration_days integer check(duration_days between 1 and 3660), plan text references public.plans(code),
 active boolean not null default false, sort_order integer not null default 0,
 description text not null default '' check(length(description)<=1000),
 promo_starts_at timestamptz, promo_ends_at timestamptz,
 digital_file_path text,
 check(promo_ends_at is null or promo_starts_at is null or promo_ends_at>promo_starts_at),
 check((type='digital_tool' and plan is null) or (type<>'digital_tool' and plan in ('plus','pro') and duration_days is not null))
);
create table public.payment_settings (
 id uuid primary key default gen_random_uuid(), product_id uuid unique references public.products(id),
 merchant_name text not null check(length(merchant_name) between 1 and 120),
 qris_path text not null check(length(qris_path) between 1 and 250),
 instructions text not null default '' check(length(instructions)<=1000),
 enabled boolean not null default false, unique_amount_enabled boolean not null default false
);
create unique index one_global_payment_setting on public.payment_settings((true)) where product_id is null;
create table public.orders (
 id uuid primary key default gen_random_uuid(),
 order_number text unique not null,
 user_id uuid not null references auth.users(id), product_id uuid not null references public.products(id),
 request_id uuid not null,
 product_name text not null, product_type text not null, price_rupiah integer not null,
 unique_amount integer not null default 0 check(unique_amount between 0 and 999),
 total_rupiah integer not null check(total_rupiah>0), duration_days integer, plan text,
 merchant_name text not null, qris_path text not null, payment_instructions text not null,
 status text not null default 'pending' check(status in ('pending','submitted','paid','rejected','expired')),
 expires_at timestamptz not null, created_at timestamptz not null default now(), submitted_at timestamptz,
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text,
 unique(user_id,request_id), unique(id,user_id), check(total_rupiah=price_rupiah+unique_amount)
);
create index orders_owner_created on public.orders(user_id,created_at desc);
create table public.payment_confirmations (
 id uuid primary key default gen_random_uuid(), order_id uuid unique not null,
 user_id uuid not null references auth.users(id), reference text not null check(length(reference) between 3 and 120),
 note text not null default '' check(length(note)<=1000), proof_path text,
 submitted_at timestamptz not null default now(),
 foreign key(order_id,user_id) references public.orders(id,user_id),
 check(proof_path is null or proof_path like user_id::text||'/'||order_id::text||'/%')
);
create index confirmation_reference on public.payment_confirmations(lower(btrim(reference)));
create table public.entitlements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 plan text not null references public.plans(code) check(plan in ('plus','pro')),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 source_order_id uuid unique not null,
 foreign key(source_order_id,user_id) references public.orders(id,user_id)
);
create index entitlement_active_owner on public.entitlements(user_id,ends_at);
alter table public.products enable row level security;
alter table public.payment_settings enable row level security;
alter table public.orders enable row level security;
alter table public.payment_confirmations enable row level security;
alter table public.entitlements enable row level security;
revoke all on public.products,public.payment_settings,public.orders,public.payment_confirmations,public.entitlements from public,anon,authenticated;
grant select on public.products,public.payment_settings to anon,authenticated;
grant select on public.orders,public.payment_confirmations,public.entitlements to authenticated;
create policy active_products on public.products for select to anon,authenticated using(active and (promo_starts_at is null or promo_starts_at<=now()) and (promo_ends_at is null or promo_ends_at>now()));
create policy enabled_payment_settings on public.payment_settings for select to anon,authenticated using(enabled);
create policy own_orders on public.orders for select to authenticated using(user_id=(select auth.uid()));
create policy own_confirmations on public.payment_confirmations for select to authenticated using(user_id=(select auth.uid()));
create policy own_entitlements on public.entitlements for select to authenticated using(user_id=(select auth.uid()));
-- Only the database owner can configure products/QRIS for now; admin UI is Session B.
insert into public.products(code,name,type,price_rupiah,duration_days,plan,active,sort_order,description) values
 ('plus-30','Plus 30 hari','subscription',9900,30,'plus',true,1,'Kuota tanpa batas, Laporan Premium dan ekspor CSV. Recurring belum tersedia.'),
 ('pro-30','Pro 30 hari','subscription',19900,30,'pro',true,2,'Semua fitur Plus yang tersedia. Analitik lanjutan, forecast dan health belum tersedia.'),
 ('early-access','Early Access Pro 12 bulan','early_access',25000,365,'pro',false,3,'Promo terbatas; harga dan periode promo harus ditetapkan admin. Bukan lifetime.');

-- One entitlement truth, compatible with protected legacy subscriptions.
create or replace function public.get_entitlement() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.plans; effective text; until_at timestamptz;
begin
 if auth.uid() is null then raise exception 'Login diperlukan.' using errcode='42501'; end if;
 select x.plan,max(x.ends_at) into effective,until_at from (
  select e.plan,e.ends_at from public.entitlements e where e.user_id=auth.uid() and e.starts_at<=now() and e.ends_at>now()
  union all select s.plan,s.expires_at from public.subscriptions s where s.user_id=auth.uid() and s.status='active' and s.plan<>'free' and s.expires_at>now()
 ) x group by x.plan order by case x.plan when 'pro' then 2 else 1 end desc limit 1;
 select * into p from public.plans where code=coalesce(effective,'free');
 return jsonb_build_object('plan',p.code,'name',p.name,'status',case when p.code<>'free' then 'active' else 'free' end,'expires_at',until_at,
 'reports_access',p.reports_access,'transactions_limit',p.transactions_limit,'categories_limit',p.categories_limit,'goals_limit',p.goals_limit,'budgets_limit',p.budgets_limit);
end $$;

-- No price argument. Browser amounts never reach order pricing.
create function public.create_order(p_product_code text,p_request_id uuid) returns public.orders language plpgsql security definer set search_path='' as $$
declare p public.products; cfg public.payment_settings; o public.orders; new_id uuid:=gen_random_uuid(); addition integer:=0;
begin
 if auth.uid() is null then raise exception 'Login diperlukan.' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'ID permintaan diperlukan.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into o from public.orders where user_id=auth.uid() and request_id=p_request_id;
 if found then return o; end if;
 select * into p from public.products where code=p_product_code and active and (promo_starts_at is null or promo_starts_at<=now()) and (promo_ends_at is null or promo_ends_at>now());
 if not found then raise exception 'Produk belum tersedia.' using errcode='22023'; end if;
 select * into cfg from public.payment_settings where enabled and (product_id=p.id or product_id is null) order by product_id nulls last limit 1;
 if not found then raise exception 'Pembayaran belum tersedia. QRIS merchant resmi belum dikonfigurasi.' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='merchant-qris' and name=cfg.qris_path) then raise exception 'Pembayaran belum tersedia. Aset QRIS belum tersedia.' using errcode='22023'; end if;
 if p.type='digital_tool' then raise exception 'Pembelian tools belum tersedia pada sesi ini.' using errcode='22023'; end if;
 if cfg.unique_amount_enabled then
  perform pg_advisory_xact_lock(hashtextextended(cfg.merchant_name,2));
  select i into addition from generate_series(1,999) i where not exists(select 1 from public.orders x where x.merchant_name=cfg.merchant_name and x.total_rupiah=p.price_rupiah+i and (x.status='submitted' or (x.status='pending' and x.expires_at>now()))) order by i limit 1;
  if addition is null then raise exception 'Nominal pencocokan belum tersedia. Coba lagi nanti.' using errcode='22023'; end if;
 end if;
 insert into public.orders(id,order_number,user_id,product_id,request_id,product_name,product_type,price_rupiah,unique_amount,total_rupiah,duration_days,plan,merchant_name,qris_path,payment_instructions,expires_at)
 values(new_id,'MB-'||to_char(now() at time zone 'Asia/Jakarta','YYMMDD')||'-'||upper(left(replace(new_id::text,'-',''),10)),auth.uid(),p.id,p_request_id,p.name,p.type,p.price_rupiah,addition,p.price_rupiah+addition,p.duration_days,p.plan,cfg.merchant_name,cfg.qris_path,cfg.instructions,now()+interval '24 hours') returning * into o;
 return o;
end $$;
create function public.list_my_orders() returns setof public.orders language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login diperlukan.' using errcode='42501'; end if;
 update public.orders set status='expired' where user_id=auth.uid() and status='pending' and expires_at<=now();
 return query select * from public.orders where user_id=auth.uid() order by created_at desc limit 100;
end $$;
create function public.submit_payment_confirmation(p_order_id uuid,p_reference text,p_note text default '',p_proof_path text default null)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 if auth.uid() is null then raise exception 'Login diperlukan.' using errcode='42501'; end if;
 select * into o from public.orders where id=p_order_id and user_id=auth.uid() for update;
 if not found then raise exception 'Pesanan tidak ditemukan.' using errcode='42501'; end if;
 if o.status='submitted' then return o; end if;
 if o.status='pending' and o.expires_at<=now() then raise exception 'Batas waktu pesanan sudah lewat. Muat ulang pesanan.' using errcode='22023'; end if;
 if o.status<>'pending' then raise exception 'Pesanan ini tidak dapat dikonfirmasi.' using errcode='22023'; end if;
 if p_reference is null or length(btrim(p_reference)) not between 3 and 120 or p_note is null or length(p_note)>1000 then raise exception 'Periksa referensi (3–120 karakter) dan catatan (maksimal 1.000).' using errcode='22023'; end if;
 if p_proof_path is not null and (p_proof_path not like auth.uid()::text||'/'||o.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='payment-proofs' and name=p_proof_path and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') and (metadata->>'size')::bigint between 1 and 5242880)) then raise exception 'Bukti pembayaran tidak valid.' using errcode='42501'; end if;
 insert into public.payment_confirmations(order_id,user_id,reference,note,proof_path) values(o.id,auth.uid(),btrim(p_reference),p_note,p_proof_path);
 update public.orders set status='submitted',submitted_at=now() where id=o.id returning * into o;
 -- Never write subscriptions/entitlements here. Only admin review may grant access.
 return o;
end $$;
revoke all on function public.create_order(text,uuid),public.list_my_orders(),public.submit_payment_confirmation(uuid,text,text,text) from public,anon;
grant execute on function public.create_order(text,uuid),public.list_my_orders(),public.submit_payment_confirmation(uuid,text,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('merchant-qris','merchant-qris',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy own_payment_proof_upload on storage.objects for insert to authenticated with check(bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.orders o where o.id::text=(storage.foldername(name))[2] and o.user_id=auth.uid() and o.status='pending' and o.expires_at>now()));
create policy own_or_admin_proof_read on storage.objects for select to authenticated using(bucket_id='payment-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
-- No overwrite/delete of submitted evidence. No public proof read policy.
-- QRIS uploads are only for protected admins, configured manually until Session B.
create policy admin_qris_insert on storage.objects for insert to authenticated with check(bucket_id='merchant-qris' and public.is_admin());
notify pgrst,'reload schema';
commit;
