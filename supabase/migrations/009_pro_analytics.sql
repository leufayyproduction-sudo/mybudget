-- Owner-only analytics; reuses the tested entitlement resolver, including expiry.
begin;
create function public.get_effective_plan() returns text language sql stable security invoker set search_path='' as $$
 select coalesce(public.get_entitlement()->>'plan','free')
$$;
create function public.get_pro_analytics() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.get_effective_plan() is distinct from 'pro' then
  raise exception 'Pro aktif diperlukan' using errcode='42501';
 end if;
 return jsonb_build_object(
  'profile',(select data from public.profiles where user_id=auth.uid()),
  'transactions',coalesce((select jsonb_agg(data||jsonb_build_object('id',id)) from public.transactions where user_id=auth.uid()),'[]'::jsonb),
  'budgets',coalesce((select jsonb_agg(data||jsonb_build_object('id',id)) from public.budgets where user_id=auth.uid()),'[]'::jsonb),
  'goals',coalesce((select jsonb_agg(data||jsonb_build_object('id',id)) from public.goals where user_id=auth.uid()),'[]'::jsonb));
end $$;
create function public.set_projected_allocation(goal_id uuid, allocation bigint) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or public.get_effective_plan() is distinct from 'pro' then raise exception 'Pro aktif diperlukan' using errcode='42501'; end if;
 if allocation is null or allocation<0 or allocation>1000000000000 then raise exception 'Alokasi tidak valid'; end if;
 update public.goals set data=jsonb_set(data,'{monthly}',to_jsonb(allocation)) where id=goal_id and user_id=auth.uid();
 if not found then raise exception 'Target tidak ditemukan' using errcode='42501'; end if;
end $$;
revoke all on function public.get_effective_plan(), public.get_pro_analytics(), public.set_projected_allocation(uuid,bigint) from public, anon;
grant execute on function public.get_effective_plan(), public.get_pro_analytics(), public.set_projected_allocation(uuid,bigint) to authenticated;
commit;
