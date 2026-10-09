begin;
-- Free remains in plans/subscriptions, never a purchasable product.
update public.products set active=false where price_rupiah<=0;
create or replace function public.create_order(p_product_code text,p_request_id uuid) returns public.orders language plpgsql security definer set search_path='' as $$
declare p public.products; cfg public.payment_settings; o public.orders; new_id uuid:=gen_random_uuid(); addition integer:=0;
begin
 if auth.uid() is null then raise exception 'Login diperlukan.' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'ID permintaan diperlukan.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into o from public.orders where user_id=auth.uid() and request_id=p_request_id;if found then if o.price_rupiah<=0 then raise exception 'Produk gratis tidak dapat dibeli.' using errcode='22023';end if;return o; end if;
 select * into p from public.products where code=p_product_code and active and (promo_starts_at is null or promo_starts_at<=now()) and (promo_ends_at is null or promo_ends_at>now());
 if found and p.price_rupiah<=0 then raise exception 'Produk gratis tidak dapat dibeli.' using errcode='22023';end if;
 if not found then raise exception 'Produk belum tersedia.' using errcode='22023'; end if;
 if p.type='digital_tool' and not exists(select 1 from public.digital_tool_products where product_id=p.id) and (p.digital_file_path is null or not exists(select 1 from storage.objects where bucket_id='digital-files' and name=p.digital_file_path)) then raise exception 'File produk belum tersedia.' using errcode='22023'; end if;
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
create or replace function public.reject_free_order() returns trigger language plpgsql set search_path='' as $$ begin if new.price_rupiah<=0 or new.total_rupiah<=0 then raise exception 'Produk gratis tidak dapat dibeli.' using errcode='22023';end if;return new;end $$;
drop trigger if exists paid_order_only on public.orders;
create trigger paid_order_only before insert on public.orders for each row execute function public.reject_free_order();
notify pgrst,'reload schema';
commit;
