begin;
-- Keep unverified legacy reviews privately; paid-order reviews require moderation.
alter table public.reviews drop constraint if exists reviews_user_id_key;
alter table public.reviews add column if not exists order_id uuid unique references public.orders(id);
alter table public.reviews add column if not exists product_id uuid references public.products(id);
-- Existing body API remains compatible; comment is the database text projection.
alter table public.reviews add column if not exists comment text generated always as (body) stored;
alter table public.reviews add column if not exists status text not null default 'hidden' check(status in ('pending','approved','hidden'));
create table if not exists public.review_attempts(user_id uuid primary key references auth.users(id) on delete cascade, attempted_at timestamptz not null);
alter table public.review_attempts enable row level security;
revoke all on public.review_attempts from public,anon,authenticated;
drop policy if exists review_owner on public.reviews;
drop policy if exists review_read on public.reviews;
create policy review_read on public.reviews for select to authenticated using(user_id=auth.uid() or public.is_admin());
revoke all on public.reviews from public,anon,authenticated;
grant select on public.reviews to authenticated;
-- Writes only through checked RPCs; clients cannot approve, move ownership or bypass rate limits.
create or replace function public.save_order_review(p_order_id uuid,p_rating integer,p_comment text,p_display_name text) returns public.reviews
language plpgsql security definer set search_path='' as $$
declare o public.orders;r public.reviews;t timestamptz;
begin
 if auth.uid() is null then raise exception 'Login diperlukan.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,77));
 select * into o from public.orders where id=p_order_id and user_id=auth.uid() and status='paid' and price_rupiah>0;
 if not found then raise exception 'Hanya pemilik pesanan terverifikasi yang dapat memberi ulasan.' using errcode='42501';end if;
 if p_rating is null or p_rating not between 1 and 5 or p_comment is null or length(btrim(p_comment)) not between 10 and 500 or p_display_name is null or length(btrim(p_display_name)) not between 2 and 60 then raise exception 'Periksa rating, komentar (10–500), dan nama (2–60).' using errcode='22023';end if;
 if p_comment ~ '[<>]' or p_display_name ~ '[<>]' then raise exception 'Gunakan teks biasa tanpa HTML.' using errcode='22023';end if;
 select attempted_at into t from public.review_attempts where user_id=auth.uid();
 if t>now()-interval '30 seconds' then raise exception 'Tunggu 30 detik sebelum mengirim lagi.' using errcode='P0001';end if;
 insert into public.review_attempts values(auth.uid(),now()) on conflict(user_id) do update set attempted_at=excluded.attempted_at;
 insert into public.reviews(user_id,order_id,product_id,rating,body,display_name,status) values(auth.uid(),o.id,o.product_id,p_rating,btrim(p_comment),btrim(p_display_name),'pending')
 on conflict(order_id) do update set rating=excluded.rating,body=excluded.body,display_name=excluded.display_name,status='pending',updated_at=now() where reviews.user_id=auth.uid() returning * into r;
 return r;
end $$;
create or replace function public.moderate_review(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare r public.reviews;
begin
 if not public.is_admin() then raise exception 'Akses ditolak.' using errcode='42501';end if;
 if p_action not in ('approved','hidden','delete') or p_action is null then raise exception 'Aksi tidak valid.' using errcode='22023';end if;
 select * into r from public.reviews where id=p_id for update;
 if not found then raise exception 'Ulasan tidak ditemukan.' using errcode='22023';end if;
 if p_action='approved' and (r.order_id is null or not exists(select 1 from public.orders where id=r.order_id and user_id=r.user_id and product_id=r.product_id and status='paid')) then raise exception 'Ulasan tidak terhubung ke pembelian terverifikasi.' using errcode='22023';end if;
 if p_action='delete' then delete from public.reviews where id=p_id;else update public.reviews set status=p_action where id=p_id;end if;
 insert into public.audit_logs(admin_id,action,object_id,before_data,after_data) values(auth.uid(),'review.'||p_action,p_id::text,to_jsonb(r),jsonb_build_object('status',p_action));
end $$;
-- Fixed public projection: no user_id, order_id, email or financial data.
create or replace function public.get_order_review(p_order_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.orders where id=p_order_id and user_id=auth.uid() and status='paid') then raise exception 'Pesanan belum terverifikasi atau bukan milikmu.' using errcode='42501';end if;
 return (select to_jsonb(r) from public.reviews r where r.order_id=p_order_id and r.user_id=auth.uid());
end $$;
revoke all on function public.get_order_review(uuid) from public,anon;
grant execute on function public.get_order_review(uuid) to authenticated;
create or replace function public.list_public_reviews(p_limit integer default 20) returns table(id uuid,display_name text,rating smallint,body text,created_at timestamptz,updated_at timestamptz) language sql stable security definer set search_path='' as $$
 select r.id,r.display_name,r.rating,r.body,r.created_at,r.updated_at from public.reviews r where r.status='approved' and r.order_id is not null order by r.created_at desc,r.id desc limit least(100,greatest(1,coalesce(p_limit,20)));
$$;
create or replace function public.review_summary() returns table(total bigint,average numeric,counts bigint[]) language sql stable security definer set search_path='' as $$
 select count(*),coalesce(round(avg(rating),1),0),array[count(*) filter(where rating=1),count(*) filter(where rating=2),count(*) filter(where rating=3),count(*) filter(where rating=4),count(*) filter(where rating=5)] from public.reviews where status='approved' and order_id is not null;
$$;
revoke all on function public.save_order_review(uuid,integer,text,text),public.moderate_review(uuid,text) from public,anon;
grant execute on function public.save_order_review(uuid,integer,text,text),public.moderate_review(uuid,text) to authenticated;
create or replace function public.list_public_reviews_page(p_offset integer default 0) returns table(id uuid,display_name text,rating smallint,body text,created_at timestamptz,updated_at timestamptz) language sql stable security definer set search_path='' as $$
 select r.id,r.display_name,r.rating,r.body,r.created_at,r.updated_at from public.reviews r where r.status='approved' and r.order_id is not null order by r.created_at desc,r.id desc limit 10 offset greatest(0,least(coalesce(p_offset,0),100000));
$$;
revoke all on function public.list_public_reviews_page(integer) from public;
grant execute on function public.list_public_reviews_page(integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
