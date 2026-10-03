begin;
create table public.insight_dismissals (
 user_id uuid not null references auth.users(id) on delete cascade,
 insight_key text not null check(length(insight_key) between 10 and 180 and insight_key like 'v1:%'),
 dismissed_at timestamptz not null default now(),primary key(user_id,insight_key)
);
alter table public.insight_dismissals enable row level security;
revoke all on public.insight_dismissals from public,anon,authenticated;
grant select,insert,delete on public.insight_dismissals to authenticated;
create policy own_pro_dismissals on public.insight_dismissals for all to authenticated
 using(user_id=auth.uid() and public.get_effective_plan()='pro')
 with check(user_id=auth.uid() and public.get_effective_plan()='pro');
create function public.get_advanced_insight_data() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare source jsonb;
begin
 source:=public.get_pro_analytics();
 return jsonb_build_object('transactions',source->'transactions','dismissed',coalesce((select jsonb_agg(insight_key) from public.insight_dismissals where user_id=auth.uid()),'[]'::jsonb));
end $$;
create function public.dismiss_insight(p_key text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.get_effective_plan() is distinct from 'pro' then raise exception 'Pro aktif diperlukan' using errcode='42501';end if;
 insert into public.insight_dismissals(user_id,insight_key) values(auth.uid(),p_key) on conflict do nothing;
end $$;
revoke all on function public.get_advanced_insight_data(),public.dismiss_insight(text) from public,anon;
grant execute on function public.get_advanced_insight_data(),public.dismiss_insight(text) to authenticated;
commit;
