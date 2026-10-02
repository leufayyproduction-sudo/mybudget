-- Apply after 001 and 002. No data is deleted. Safe to run again.
begin;
alter view public.public_reviews set (security_invoker = true);
revoke all on public.public_reviews from public, anon, authenticated;
alter table public.reviews enable row level security;

-- Intentional public endpoint: fixed projection, no owner UUID/email/private profile.
create or replace function public.list_public_reviews(p_limit integer default 20)
returns table(id uuid,display_name text,rating smallint,body text,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.id,r.display_name,r.rating,r.body,r.created_at,r.updated_at
 from public.reviews r
 order by r.created_at desc,r.id desc
 limit least(100,greatest(1,coalesce(p_limit,20)));
$$;
revoke all on function public.list_public_reviews(integer) from public;
grant execute on function public.list_public_reviews(integer) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
