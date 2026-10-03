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
create function public.get_advanced_report_data(p_from date,p_to date,p_compare_from date,p_compare_to date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.get_effective_plan() is distinct from 'pro' then raise exception 'Pro aktif diperlukan' using errcode='42501';end if;
 if p_from is null or p_to is null or p_compare_from is null or p_compare_to is null
 or p_from>p_to or p_compare_from>p_compare_to or p_to-p_from>730 or p_compare_to-p_compare_from>730
 or p_from<date '2000-01-01' or p_compare_from<date '2000-01-01'
 or greatest(p_to,p_compare_to)>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Periode tidak valid (maksimum 731 hari)' using errcode='22023';end if;
 if (select count(*) from public.transactions where user_id=auth.uid() and ((data->>'date')::date between p_from and p_to or (data->>'date')::date between p_compare_from and p_compare_to))>50000 then raise exception 'Perpendek periode: maksimum 50000 transaksi per laporan' using errcode='22023';end if;
 select coalesce(jsonb_agg(data||jsonb_build_object('id',id)),'[]'::jsonb) into result from public.transactions
 where user_id=auth.uid() and ((data->>'date')::date between p_from and p_to or (data->>'date')::date between p_compare_from and p_compare_to);
 return result;
end $$;
revoke all on function public.get_advanced_report_data(date,date,date,date) from public,anon;
grant execute on function public.get_advanced_report_data(date,date,date,date) to authenticated;
commit;
