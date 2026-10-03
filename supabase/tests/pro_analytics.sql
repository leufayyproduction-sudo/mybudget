-- Owner SQL Editor, replace __USER_A__ / __USER_B__ with dedicated test account IDs.
-- Does not change roles, receive payments or persist upgrades. Run after migration 009.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end$$;
create function pg_temp.denied(query text) returns boolean language plpgsql as $$begin execute query; return false; exception when insufficient_privilege then return true; end$$;
select pg_temp.assert_true('__USER_A__'<>'__USER_B__','two different dedicated accounts');
-- Rollback-only cleanup of premium grants, limited to these test accounts.
delete from public.entitlements where user_id in ('__USER_A__'::uuid,'__USER_B__'::uuid);
insert into public.subscriptions(user_id,plan,status,expires_at) values
 ('__USER_A__','free','active',null),('__USER_B__','free','active',null)
 on conflict(user_id) do update set plan='free',status='active',expires_at=null;
select set_config('request.jwt.claims','{"sub":"__USER_A__","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied('select public.get_pro_analytics()'),'Free analytics denied');
select pg_temp.assert_true(pg_temp.denied('select public.set_projected_allocation(''00000000-0000-0000-0000-000000000009'',20000)'),'Free projection write denied');
reset role;
update public.subscriptions set plan='plus',expires_at=now()+interval '1 day' where user_id='__USER_A__';
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied('select public.get_pro_analytics()'),'Plus analytics denied');
reset role;
update public.subscriptions set plan='pro',expires_at=now()-interval '1 day' where user_id='__USER_A__';
set local role authenticated;
select pg_temp.assert_true(public.get_effective_plan()='free','Expired becomes Free');
select pg_temp.assert_true(pg_temp.denied('select public.get_pro_analytics()'),'Expired analytics denied');
reset role;
update public.subscriptions set plan='pro',expires_at=now()+interval '1 day' where user_id in ('__USER_A__','__USER_B__');
insert into public.goals(id,user_id,data) values
 ('00000000-0000-0000-0000-000000000009','__USER_B__','{"name":"TEST rollback","target":20000,"saved":0,"monthly":0}');
set local role authenticated;
select pg_temp.assert_true(public.get_effective_plan()='pro','Active Pro accepted');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.get_pro_analytics()->'goals') g where g->>'id'='00000000-0000-0000-0000-000000000009'),'A analytics excludes B goals');
select pg_temp.assert_true(pg_temp.denied('select public.set_projected_allocation(''00000000-0000-0000-0000-000000000009'',20000)'),'A cannot change B allocation');
reset role;
select set_config('request.jwt.claims','{"sub":"__USER_B__","role":"authenticated"}',true);
set local role authenticated;
select public.set_projected_allocation('00000000-0000-0000-0000-000000000009',20000);
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(public.get_pro_analytics()->'goals') g where g->>'id'='00000000-0000-0000-0000-000000000009' and g->>'monthly'='20000'),'B can confirm own allocation');
reset role;
select 'PASS: Pro analytics assertions; rollback removes fixtures and upgrades' as result;
rollback;
