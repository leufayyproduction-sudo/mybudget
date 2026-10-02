begin;
create policy admin_products_read on public.products for select to authenticated using(public.is_admin());
create policy admin_payment_settings_read on public.payment_settings for select to authenticated using(public.is_admin());
create table public.download_logs(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),product_id uuid not null references public.products(id),created_at timestamptz not null default now());
alter table public.download_logs enable row level security;
revoke all on public.download_logs from public,anon,authenticated;
grant select on public.download_logs to authenticated;
create policy own_download_logs on public.download_logs for select to authenticated using(user_id=auth.uid());
create function public.admin_save_product(p_data jsonb) returns public.products language plpgsql security definer set search_path='' as $$
declare before_row public.products; after_row public.products; product_id uuid;
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Produk tidak valid.' using errcode='22023'; end if;
 product_id:=coalesce((p_data->>'id')::uuid,gen_random_uuid());
 select * into before_row from public.products where id=product_id for update;
 if p_data->>'type'='early_access' and (p_data->>'active')::boolean and (nullif(p_data->>'promo_starts_at','') is null or nullif(p_data->>'promo_ends_at','') is null) then raise exception 'Early Access aktif memerlukan periode promo.' using errcode='22023'; end if;
 if nullif(p_data->>'digital_file_path','') is not null and not exists(select 1 from storage.objects where bucket_id='digital-files' and name=p_data->>'digital_file_path') then raise exception 'File privat tidak ditemukan.' using errcode='22023'; end if;
 if p_data->>'type'='digital_tool' and (p_data->>'active')::boolean and nullif(p_data->>'digital_file_path','') is null then raise exception 'Unggah file pendukung sebelum mengaktifkan produk digital.' using errcode='22023'; end if;
 insert into public.products(id,code,name,type,price_rupiah,duration_days,plan,active,sort_order,description,promo_starts_at,promo_ends_at,digital_file_path)
 values(product_id,p_data->>'code',btrim(p_data->>'name'),p_data->>'type',(p_data->>'price_rupiah')::integer,(p_data->>'duration_days')::integer,p_data->>'plan',(p_data->>'active')::boolean,(p_data->>'sort_order')::integer,p_data->>'description',nullif(p_data->>'promo_starts_at','')::timestamptz,nullif(p_data->>'promo_ends_at','')::timestamptz,nullif(p_data->>'digital_file_path',''))
 on conflict(id) do update set code=excluded.code,name=excluded.name,type=excluded.type,price_rupiah=excluded.price_rupiah,duration_days=excluded.duration_days,plan=excluded.plan,active=excluded.active,sort_order=excluded.sort_order,description=excluded.description,promo_starts_at=excluded.promo_starts_at,promo_ends_at=excluded.promo_ends_at,digital_file_path=excluded.digital_file_path returning * into after_row;
 insert into public.audit_logs(admin_id,action,object_id,before_data,after_data) values(auth.uid(),'product.save',product_id::text,to_jsonb(before_row),to_jsonb(after_row));
 return after_row;
end $$;
create function public.admin_save_payment_settings(p_data jsonb) returns public.payment_settings language plpgsql security definer set search_path='' as $$
declare before_row public.payment_settings; after_row public.payment_settings; setting_id uuid;
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Pengaturan tidak valid.' using errcode='22023'; end if;
 setting_id:=coalesce((p_data->>'id')::uuid,gen_random_uuid());
 select * into before_row from public.payment_settings where id=setting_id for update;
 if not exists(select 1 from storage.objects where bucket_id='merchant-qris' and name=p_data->>'qris_path' and metadata->>'mimetype' in('image/jpeg','image/png','image/webp') and (metadata->>'size')::bigint between 1 and 5242880) then raise exception 'Unggah gambar QRIS resmi lebih dahulu.' using errcode='22023'; end if;
 insert into public.payment_settings(id,product_id,merchant_name,qris_path,instructions,enabled,unique_amount_enabled)
 values(setting_id,(p_data->>'product_id')::uuid,btrim(p_data->>'merchant_name'),p_data->>'qris_path',p_data->>'instructions',(p_data->>'enabled')::boolean,(p_data->>'unique_amount_enabled')::boolean)
 on conflict(id) do update set product_id=excluded.product_id,merchant_name=excluded.merchant_name,qris_path=excluded.qris_path,instructions=excluded.instructions,enabled=excluded.enabled,unique_amount_enabled=excluded.unique_amount_enabled returning * into after_row;
 insert into public.audit_logs(admin_id,action,object_id,before_data,after_data) values(auth.uid(),'payment_settings.save',setting_id::text,to_jsonb(before_row),to_jsonb(after_row));return after_row;
end $$;
create function public.admin_record_asset(p_bucket text,p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
 if p_bucket not in ('merchant-qris','digital-files','site-assets') or p_path not like auth.uid()::text||'/%' or not exists(select 1 from storage.objects where bucket_id=p_bucket and name=p_path) then raise exception 'Aset tidak valid.' using errcode='22023'; end if;
 insert into public.audit_logs(admin_id,action,object_id,after_data) values(auth.uid(),'asset.upload',p_path,jsonb_build_object('bucket',p_bucket));
end $$;
create function public.get_paid_download(p_product_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare file_path text;
begin
 if auth.uid() is null or not exists(select 1 from public.orders where user_id=auth.uid() and product_id=p_product_id and status='paid' and product_type='digital_tool') then raise exception 'Pembelian terverifikasi diperlukan.' using errcode='42501'; end if;
 select digital_file_path into file_path from public.products where id=p_product_id and type='digital_tool';
 if file_path is null or not exists(select 1 from storage.objects where bucket_id='digital-files' and name=file_path) then raise exception 'File belum tersedia.' using errcode='22023'; end if;
 insert into public.download_logs(user_id,product_id) values(auth.uid(),p_product_id);return file_path;
end $$;
revoke all on function public.admin_save_product(jsonb),public.admin_save_payment_settings(jsonb),public.admin_record_asset(text,text),public.get_paid_download(uuid) from public,anon;
grant execute on function public.admin_save_product(jsonb),public.admin_save_payment_settings(jsonb),public.admin_record_asset(text,text),public.get_paid_download(uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('digital-files','digital-files',false,20971520,array['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),('site-assets','site-assets',true,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy admin_digital_insert on storage.objects for insert to authenticated with check(bucket_id='digital-files' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create function public.can_read_paid_file(p_path text) returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from public.products p join public.orders o on o.product_id=p.id where p.digital_file_path=p_path and o.user_id=auth.uid() and o.status='paid' and o.product_type='digital_tool'); $$;
revoke all on function public.can_read_paid_file(text) from public,anon;
grant execute on function public.can_read_paid_file(text) to authenticated;
create policy paid_digital_read on storage.objects for select to authenticated using(bucket_id='digital-files' and (public.is_admin() or public.can_read_paid_file(name)));
create policy admin_site_asset_insert on storage.objects for insert to authenticated with check(bucket_id='site-assets' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
-- Historical orders are never edited by catalogue/configuration RPCs.
create or replace function public.create_order(p_product_code text,p_request_id uuid) returns public.orders language plpgsql security definer set search_path='' as $$
declare p public.products; cfg public.payment_settings; o public.orders; new_id uuid:=gen_random_uuid(); addition integer:=0;
begin
 if auth.uid() is null then raise exception 'Login diperlukan.' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'ID permintaan diperlukan.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into o from public.orders where user_id=auth.uid() and request_id=p_request_id;if found then return o; end if;
 select * into p from public.products where code=p_product_code and active and (promo_starts_at is null or promo_starts_at<=now()) and (promo_ends_at is null or promo_ends_at>now());
 if not found then raise exception 'Produk belum tersedia.' using errcode='22023'; end if;
 if p.type='digital_tool' and (p.digital_file_path is null or not exists(select 1 from storage.objects where bucket_id='digital-files' and name=p.digital_file_path)) then raise exception 'File produk belum tersedia.' using errcode='22023'; end if;
 select * into cfg from public.payment_settings where enabled and (product_id=p.id or product_id is null) order by product_id nulls last limit 1;
 if not found then raise exception 'Pembayaran belum tersedia. QRIS merchant resmi belum dikonfigurasi.' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='merchant-qris' and name=cfg.qris_path) then raise exception 'Pembayaran belum tersedia. Aset QRIS belum tersedia.' using errcode='22023'; end if;
 if cfg.unique_amount_enabled then
  perform pg_advisory_xact_lock(hashtextextended(cfg.merchant_name,2));
  select i into addition from generate_series(1,999) i where not exists(select 1 from public.orders x where x.merchant_name=cfg.merchant_name and x.total_rupiah=p.price_rupiah+i and (x.status='submitted' or (x.status='pending' and x.expires_at>now()))) order by i limit 1;
  if addition is null then raise exception 'Nominal pencocokan belum tersedia. Coba lagi nanti.' using errcode='22023'; end if;
 end if;
 insert into public.orders(id,order_number,user_id,product_id,request_id,product_name,product_type,price_rupiah,unique_amount,total_rupiah,duration_days,plan,merchant_name,qris_path,payment_instructions,expires_at)
 values(new_id,'MB-'||to_char(now() at time zone 'Asia/Jakarta','YYMMDD')||'-'||upper(left(replace(new_id::text,'-',''),10)),auth.uid(),p.id,p_request_id,p.name,p.type,p.price_rupiah,addition,p.price_rupiah+addition,p.duration_days,p.plan,cfg.merchant_name,cfg.qris_path,cfg.instructions,now()+interval '24 hours') returning * into o;return o;
end $$;
notify pgrst,'reload schema';
commit;
