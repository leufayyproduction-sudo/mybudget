-- Public, opt-in display name + review only. Private owner IDs stay behind RLS.
create table public.reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 display_name text not null check (char_length(trim(display_name)) between 2 and 60),
 rating smallint not null check (rating between 1 and 5),
 body text not null check (char_length(trim(body)) between 10 and 1000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy review_owner on public.reviews for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.reviews from anon,authenticated;
grant select,delete on public.reviews to authenticated;
grant insert(user_id,display_name,rating,body),update(user_id,display_name,rating,body) on public.reviews to authenticated;
create function public.review_timestamps() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create trigger review_updated before update on public.reviews for each row execute function public.review_timestamps();
-- Deliberate owner-rights projection: only consented public fields, never user_id/email/profile.
create view public.public_reviews as select id,display_name,rating,body,created_at,updated_at from public.reviews;
grant select on public.public_reviews to anon,authenticated;
create function public.review_summary() returns table(total bigint,average numeric,counts bigint[])
language sql stable security definer set search_path='' as $$
 select count(*),coalesce(round(avg(rating),1),0),
 array[count(*) filter(where rating=1),count(*) filter(where rating=2),count(*) filter(where rating=3),count(*) filter(where rating=4),count(*) filter(where rating=5)]
 from public.reviews;
$$;
revoke all on function public.review_summary() from public;
grant execute on function public.review_summary() to anon,authenticated;
