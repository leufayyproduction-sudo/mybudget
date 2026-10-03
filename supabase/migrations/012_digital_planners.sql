begin;
insert into public.products(code,name,type,price_rupiah,active,description) values
 ('budget-planner','Budget planner','digital_tool',9900,false,'Planner budget interaktif. Produk belum diaktifkan sebelum verifikasi.'),
 ('savings-planner','Savings planner','digital_tool',9900,false,'Planner tabungan interaktif.'),
 ('freelancer-planner','Freelancer finance planner','digital_tool',14900,false,'Perencanaan pemasukan project dan cadangan, bukan jaminan.'),
 ('goal-planner','Goal planner','digital_tool',9900,false,'Simulasi target dan alokasi.') on conflict(code) do nothing;
create table public.digital_tool_products(tool_code text primary key check(tool_code in ('budget','savings','freelancer','goal')),product_id uuid unique not null references public.products(id));
insert into public.digital_tool_products select v.tool,p.id from (values('budget','budget-planner'),('savings','savings-planner'),('freelancer','freelancer-planner'),('goal','goal-planner')) v(tool,code) join public.products p on p.code=v.code and p.type='digital_tool';
alter table public.digital_tool_products enable row level security;
revoke all on public.digital_tool_products from public,anon,authenticated;
grant select on public.digital_tool_products to anon,authenticated;
create policy public_tool_mapping on public.digital_tool_products for select using(true);
create function public.can_use_tool(p_tool text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.digital_tool_products m join public.orders o on o.product_id=m.product_id where m.tool_code=p_tool and o.user_id=auth.uid() and o.status='paid' and o.product_type='digital_tool')
$$;
create function public.valid_planner_input(p_tool text,p_input jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare keys text[];k text;n numeric;
begin
 keys:=case p_tool when 'budget' then array['income','essential','wants','saving'] when 'savings' then array['target','saved','monthly','months'] when 'goal' then array['target','saved','monthly','months'] when 'freelancer' then array['projectIncome','projects','essential','reserveMonths','reserveMonthly'] else null end;
 if keys is null or p_input is null or jsonb_typeof(p_input)<>'object' or not p_input ?& keys or (select count(*) from jsonb_object_keys(p_input))<>cardinality(keys) then return false;end if;
 foreach k in array keys loop
  if jsonb_typeof(p_input->k)<>'number' then return false;end if;n:=(p_input->>k)::numeric;
  if n<>trunc(n) or n<case when k in ('months','reserveMonths') then 1 else 0 end or n>case k when 'months' then 1200 when 'reserveMonths' then 24 when 'projects' then 1000 else 1000000000000 end then return false;end if;
 end loop;return true;
end $$;
create table public.planner_results(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,tool_code text not null references public.digital_tool_products(tool_code),title text not null check(length(title) between 1 and 80),inputs jsonb not null,created_at timestamptz not null default now(),check(public.valid_planner_input(tool_code,inputs)));
alter table public.planner_results enable row level security;
revoke all on public.planner_results from public,anon,authenticated;
grant select,insert,delete on public.planner_results to authenticated;
create policy own_paid_planner on public.planner_results for all to authenticated using(user_id=auth.uid() and public.can_use_tool(tool_code)) with check(user_id=auth.uid() and public.can_use_tool(tool_code));
create function public.get_tool_data(p_tool text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.can_use_tool(p_tool) then raise exception 'Pesanan paid diperlukan' using errcode='42501';end if;
 return jsonb_build_object('saved',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from public.planner_results r where user_id=auth.uid() and tool_code=p_tool),'[]'::jsonb));
end $$;
create function public.save_tool_result(p_tool text,p_title text,p_inputs jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare saved uuid;
begin
 if not public.can_use_tool(p_tool) then raise exception 'Pesanan paid diperlukan' using errcode='42501';end if;
 insert into public.planner_results(user_id,tool_code,title,inputs) values(auth.uid(),p_tool,p_title,p_inputs) returning id into saved;return saved;
end $$;
revoke all on function public.can_use_tool(text),public.valid_planner_input(text,jsonb),public.get_tool_data(text),public.save_tool_result(text,text,jsonb) from public,anon;
grant execute on function public.can_use_tool(text),public.valid_planner_input(text,jsonb),public.get_tool_data(text),public.save_tool_result(text,text,jsonb) to authenticated;
-- Interactive tools do not require a supporting file. QRIS and manual checks stay mandatory.
create or replace function public.create_order(p_product_code text,p_request_id uuid) returns public.orders language plpgsql security definer set search_path='' as $$
declare p public.products;cfg public.payment_settings;o public.orders;new_id uuid:=gen_random_uuid();addition integer:=0;
begin
 if auth.uid() is null then raise exception 'Login diperlukan' using errcode='42501';end if;
 if p_request_id is null then raise exception 'ID permintaan diperlukan' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into o from public.orders where user_id=auth.uid() and request_id=p_request_id;if found then return o;end if;
 select * into p from public.products where code=p_product_code and active and (promo_starts_at is null or promo_starts_at<=now()) and (promo_ends_at is null or promo_ends_at>now());
 if not found then raise exception 'Produk belum tersedia' using errcode='22023';end if;
 if p.type='digital_tool' and not exists(select 1 from public.digital_tool_products where product_id=p.id) and (p.digital_file_path is null or not exists(select 1 from storage.objects where bucket_id='digital-files' and name=p.digital_file_path)) then raise exception 'File produk belum tersedia' using errcode='22023';end if;
 select * into cfg from public.payment_settings where enabled and (product_id=p.id or product_id is null) order by product_id nulls last limit 1;
 if not found then raise exception 'Pembayaran belum tersedia' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='merchant-qris' and name=cfg.qris_path) then raise exception 'QRIS resmi belum tersedia' using errcode='22023';end if;
 if cfg.unique_amount_enabled then
  perform pg_advisory_xact_lock(hashtextextended(cfg.merchant_name,2));
  select i into addition from generate_series(1,999) i where not exists(select 1 from public.orders x where x.merchant_name=cfg.merchant_name and x.total_rupiah=p.price_rupiah+i and (x.status='submitted' or (x.status='pending' and x.expires_at>now()))) order by i limit 1;
  if addition is null then raise exception 'Nominal pencocokan belum tersedia' using errcode='22023';end if;
 end if;
 insert into public.orders(id,order_number,user_id,product_id,request_id,product_name,product_type,price_rupiah,unique_amount,total_rupiah,duration_days,plan,merchant_name,qris_path,payment_instructions,expires_at)
 values(new_id,'MB-'||to_char(now() at time zone 'Asia/Jakarta','YYMMDD')||'-'||upper(left(replace(new_id::text,'-',''),10)),auth.uid(),p.id,p_request_id,p.name,p.type,p.price_rupiah,addition,p.price_rupiah+addition,p.duration_days,p.plan,cfg.merchant_name,cfg.qris_path,cfg.instructions,now()+interval '24 hours') returning * into o;return o;
end $$;
commit;
