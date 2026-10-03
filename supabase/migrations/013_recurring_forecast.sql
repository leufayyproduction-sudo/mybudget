begin;
create function public.get_forecast_analytics() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare source jsonb;txs jsonb;
begin
 source:=public.get_pro_analytics(); -- Pro + owner RLS already enforced
 select coalesce(jsonb_agg(t.value||jsonb_build_object('origin',case when exists(select 1 from public.recurring_occurrences o where o.user_id=auth.uid() and o.transaction_id=(t.value->>'id')::uuid) then 'recurring' else null end)),'[]'::jsonb) into txs from jsonb_array_elements(source->'transactions') t;
 return source||jsonb_build_object('transactions',txs,'recurring',coalesce((select jsonb_agg(to_jsonb(r)) from public.recurring_rules r where user_id=auth.uid()),'[]'::jsonb));
end $$;
revoke all on function public.get_forecast_analytics() from public,anon;
grant execute on function public.get_forecast_analytics() to authenticated;
commit;
