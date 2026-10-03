-- Only for dedicated, empty account A. This fixture MUST COMMIT for two API calls
-- to see it. No payment/QRIS, no admin-role change. Cleanup restores the snapshot.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
select pg_temp.assert_true(not exists(select 1 from public.profiles where user_id='__USER_A__') and not exists(select 1 from public.transactions where user_id='__USER_A__') and not exists(select 1 from public.recurring_rules where user_id='__USER_A__'),'dedicated empty account A');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"__USER_A__","role":"authenticated"}',true);
select pg_temp.assert_true(public.get_effective_plan()='free','A starts Free');
reset role;
create table public._phase3_parallel_fixture(id uuid primary key,user_id uuid not null,rule_id uuid,subscription_backup jsonb);
alter table public._phase3_parallel_fixture enable row level security;
revoke all on public._phase3_parallel_fixture from public,anon,authenticated;
insert into public._phase3_parallel_fixture values('__RUN__','__USER_A__',null,(select to_jsonb(s) from public.subscriptions s where user_id='__USER_A__'));
insert into public.subscriptions(user_id,plan,status,expires_at) values('__USER_A__','plus','active',now()+interval '1 hour') on conflict(user_id) do update set plan='plus',status='active',expires_at=excluded.expires_at;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"__USER_A__","role":"authenticated"}',true);
select set_config('test.parallel_rule',public.save_recurring(null,20000,'expense','Tagihan','TEST PARALLEL NO PAYMENT','weekly',(now() at time zone 'Asia/Jakarta')::date-1,(now() at time zone 'Asia/Jakarta')::date-1,true)::text,true);
reset role;
update public._phase3_parallel_fixture set rule_id=current_setting('test.parallel_rule')::uuid where id='__RUN__';
create function public.phase3_parallel_status(p_run uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public._phase3_parallel_fixture;
begin
 select * into f from public._phase3_parallel_fixture where id=p_run and user_id=auth.uid();if not found then raise exception 'Akses ditolak' using errcode='42501';end if;
 return jsonb_build_object('occurrences',(select count(*) from public.recurring_occurrences where rule_id=f.rule_id and user_id=f.user_id),'transactions',(select count(*) from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.rule_id=f.rule_id and t.user_id=f.user_id));
end $$;
create function public.phase3_parallel_cleanup(p_run uuid) returns void language plpgsql security definer set search_path='' as $$
declare f public._phase3_parallel_fixture;s public.subscriptions;
begin
 select * into f from public._phase3_parallel_fixture where id=p_run and user_id=auth.uid() for update;if not found then raise exception 'Akses ditolak' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(f.user_id::text,0));
 delete from public.transactions where user_id=f.user_id and id in(select transaction_id from public.recurring_occurrences where rule_id=f.rule_id and user_id=f.user_id);
 delete from public.recurring_occurrences where rule_id=f.rule_id and user_id=f.user_id;
 delete from public.recurring_rules where id=f.rule_id and user_id=f.user_id;
 if f.subscription_backup is null then delete from public.subscriptions where user_id=f.user_id;
 else s:=jsonb_populate_record(null::public.subscriptions,f.subscription_backup);update public.subscriptions set plan=s.plan,status=s.status,expires_at=s.expires_at,updated_at=s.updated_at where user_id=f.user_id;end if;
 delete from public._phase3_parallel_fixture where id=p_run;
end $$;
revoke all on function public.phase3_parallel_status(uuid),public.phase3_parallel_cleanup(uuid) from public,anon;
grant execute on function public.phase3_parallel_status(uuid),public.phase3_parallel_cleanup(uuid) to authenticated;
commit;
select 'READY: one TEST rule committed; run node scripts/verify-phase3-parallel.mjs; no payment' as result;
