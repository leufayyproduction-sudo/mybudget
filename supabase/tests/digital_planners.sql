-- Owner SQL Editor, dedicated accounts only. TEST metadata, no payment/QRIS, full rollback.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$begin execute q;return false;exception when insufficient_privilege then return true;end$$;
select pg_temp.assert_true('__USER_A__'<>'__USER_B__','different accounts');
select pg_temp.assert_true((select count(*)=4 from public.digital_tool_products),'four protected product mappings');
-- These dedicated test users must not already own paid planners.
select pg_temp.assert_true(not exists(select 1 from public.orders o join public.digital_tool_products m on m.product_id=o.product_id where o.user_id in ('__USER_A__','__USER_B__') and o.status='paid'),'no existing paid planner orders');
insert into public.subscriptions(user_id,plan,status,expires_at) values('__USER_B__','pro','active',now()+interval '1 day') on conflict(user_id) do update set plan='pro',status='active',expires_at=excluded.expires_at;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"__USER_A__","role":"authenticated"}',true);
select pg_temp.assert_true(not public.can_use_tool('budget'),'unpaid tool denied');
select pg_temp.assert_true(pg_temp.denied('select public.get_tool_data(''budget'')'),'unpaid read denied');
select pg_temp.assert_true(pg_temp.denied('select public.save_tool_result(''budget'',''TEST'',''{"income":20000,"essential":10000,"wants":0,"saving":0}'')'),'unpaid save denied');
reset role;
-- Owner creates rollback-only TEST orders; no receipt is claimed and no merchant asset is used.
insert into public.orders(id,order_number,user_id,product_id,request_id,product_name,product_type,price_rupiah,total_rupiah,merchant_name,qris_path,payment_instructions,status,expires_at)
select gen_random_uuid(),'TEST-PLANNER-'||gen_random_uuid()::text,'__USER_A__',p.id,gen_random_uuid(),'TEST rollback '||p.name,'digital_tool',p.price_rupiah,p.price_rupiah,'TEST NO PAYMENT','TEST NO QRIS','SQL TEST ONLY','submitted',now()+interval '1 day' from public.digital_tool_products m join public.products p on p.id=m.product_id;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"__USER_A__","role":"authenticated"}',true);
select pg_temp.assert_true(not public.can_use_tool('budget'),'submitted does not unlock');
reset role;
update public.orders set status='paid',reviewed_by='__USER_B__',reviewed_at=now(),review_note='TEST rollback ONLY; NO PAYMENT' where user_id='__USER_A__' and order_number like 'TEST-PLANNER-%';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"__USER_A__","role":"authenticated"}',true);
select pg_temp.assert_true(public.can_use_tool('budget') and public.can_use_tool('savings') and public.can_use_tool('freelancer') and public.can_use_tool('goal'),'paid grants exactly mapped products');
select set_config('test.planner',public.save_tool_result('budget','TEST rollback A','{"income":20000,"essential":10000,"wants":0,"saving":0}')::text,true);
select public.save_tool_result('savings','TEST savings','{"target":20000,"saved":0,"monthly":0,"months":12}');
select public.save_tool_result('goal','TEST goal','{"target":20000,"saved":20000,"monthly":0,"months":12}');
select public.save_tool_result('freelancer','TEST freelancer','{"projectIncome":20000,"projects":2,"essential":20000,"reserveMonths":3,"reserveMonthly":0}');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(public.get_tool_data('budget')->'saved') r where r->>'id'=current_setting('test.planner')),'owner result visible');
select pg_temp.assert_true(not public.valid_planner_input('budget','{"income":0.5,"essential":0,"wants":0,"saving":0}'),'fraction denied');
select pg_temp.assert_true(not public.valid_planner_input('budget','{"income":0,"essential":0,"wants":0,"saving":0,"user_id":"B"}'),'unknown field denied');
select pg_temp.assert_true(pg_temp.denied('insert into public.planner_results(user_id,tool_code,title,inputs) values(''__USER_B__'',''budget'',''TEST'',''{"income":0,"essential":0,"wants":0,"saving":0}'')'),'A cannot write B results');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"__USER_B__","role":"authenticated"}',true);
select pg_temp.assert_true(public.get_effective_plan()='pro','B is Pro but still needs paid tool');
select pg_temp.assert_true(not public.can_use_tool('budget'),'B does not inherit A paid access');
select pg_temp.assert_true(not exists(select 1 from public.planner_results where id=current_setting('test.planner')::uuid),'B cannot read A results');
select pg_temp.assert_true(pg_temp.denied('select public.get_tool_data(''budget'')'),'B RPC denied');
delete from public.planner_results where id=current_setting('test.planner')::uuid;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"__USER_A__","role":"authenticated"}',true);
select pg_temp.assert_true(exists(select 1 from public.planner_results where id=current_setting('test.planner')::uuid),'B delete did not affect A');
reset role;
select 'PASS: digital planner assertions; rollback removes TEST orders and results' as result;
rollback;
