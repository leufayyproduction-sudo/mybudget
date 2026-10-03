-- Owner cleanup, safe after verifier or after an interrupted verifier. No other user/rule touched.
begin;
do $$declare f public._phase3_parallel_fixture;s public.subscriptions;
begin
 select * into f from public._phase3_parallel_fixture where id='__RUN__' and user_id='__USER_A__' for update;
 if found then
  perform pg_advisory_xact_lock(hashtextextended(f.user_id::text,0));
  delete from public.transactions where user_id=f.user_id and id in(select transaction_id from public.recurring_occurrences where rule_id=f.rule_id and user_id=f.user_id);
  delete from public.recurring_occurrences where rule_id=f.rule_id and user_id=f.user_id;
  delete from public.recurring_rules where id=f.rule_id and user_id=f.user_id;
  if f.subscription_backup is null then delete from public.subscriptions where user_id=f.user_id;else s:=jsonb_populate_record(null::public.subscriptions,f.subscription_backup);update public.subscriptions set plan=s.plan,status=s.status,expires_at=s.expires_at,updated_at=s.updated_at where user_id=f.user_id;end if;
  delete from public._phase3_parallel_fixture where id=f.id;
 end if;
 if exists(select 1 from public._phase3_parallel_fixture) then raise exception 'FAIL: unexpected fixture; helper not removed';end if;
end $$;
drop function public.phase3_parallel_status(uuid);
drop function public.phase3_parallel_cleanup(uuid);
drop table public._phase3_parallel_fixture;
commit;
select 'PASS: parallel fixtures/helper removed, subscription restored' as result;
