-- Owner SQL Editor, two disposable users; all upgrades/orders roll back.
begin;
select set_config('test.user_a','__USER_A__',true),set_config('test.user_b','__USER_B__',true);
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.denied(command text,code text) returns boolean language plpgsql as $$ begin execute command;return false;exception when others then return sqlstate=code;end $$;
select pg_temp.assert_true(not exists(select 1 from public.profiles where user_id in(current_setting('test.user_a')::uuid,current_setting('test.user_b')::uuid)),'dedicated test accounts');
select pg_temp.assert_true(not exists(select 1 from public.admin_users where user_id in(current_setting('test.user_a')::uuid,current_setting('test.user_b')::uuid)),'no existing test admin');
insert into public.products(code,name,type,price_rupiah,duration_days,plan,active) values('test-admin','TEST ONLY','subscription',9900,30,'plus',false);
select set_config('test.product',(select id::text from public.products where code='test-admin'),true);
insert into public.orders(order_number,user_id,product_id,request_id,product_name,product_type,price_rupiah,total_rupiah,duration_days,plan,merchant_name,qris_path,payment_instructions,status,expires_at,submitted_at)
values('TEST-ADMIN-1',current_setting('test.user_b')::uuid,current_setting('test.product')::uuid,gen_random_uuid(),'TEST ONLY','subscription',9900,9900,30,'plus','TEST NO PAYMENT','no-file','No payment','submitted',now()+interval '24 hours',now()),
('TEST-ADMIN-2',current_setting('test.user_b')::uuid,current_setting('test.product')::uuid,gen_random_uuid(),'TEST ONLY','subscription',9900,9900,30,'plus','TEST NO PAYMENT','no-file','No payment','submitted',now()+interval '24 hours',now());
select set_config('test.order',(select id::text from public.orders where order_number='TEST-ADMIN-1'),true),set_config('test.order2',(select id::text from public.orders where order_number='TEST-ADMIN-2'),true);
insert into public.payment_confirmations(order_id,user_id,reference) select id,user_id,'TEST-DUPLICATE' from public.orders where order_number in('TEST-ADMIN-1','TEST-ADMIN-2');
select set_config('request.jwt.claim.sub',current_setting('test.user_b'),true);
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied($q$select public.admin_review_order(current_setting('test.order')::uuid,'paid','')$q$,'42501'),'non-admin review denied');
select pg_temp.assert_true(pg_temp.denied($q$select public.admin_purchase_summary()$q$,'42501'),'non-admin summary denied');
select pg_temp.assert_true(pg_temp.denied($q$select public.admin_list_orders()$q$,'42501'),'non-admin list denied');
select pg_temp.assert_true((select count(*)=0 from public.audit_logs),'non-admin audit inaccessible');
reset role;
insert into public.admin_users(user_id) values(current_setting('test.user_a')::uuid);
-- A finance fixture owned by B; no admin exception exists for any private finance table.
insert into public.transactions(user_id,data) values(current_setting('test.user_b')::uuid,'{"type":"income","amount":20000,"category":"Project","date":"2026-01-01","description":"TEST"}');
select set_config('request.jwt.claim.sub',current_setting('test.user_a'),true);
set local role authenticated;
select pg_temp.assert_true(public.is_admin(),'manual admin role works');
select pg_temp.assert_true((select count(*)=0 from public.transactions where user_id=current_setting('test.user_b')::uuid),'admin cannot read private transactions');
select pg_temp.assert_true((select count(*)=0 from public.budgets where user_id=current_setting('test.user_b')::uuid),'admin cannot read private budgets');
select pg_temp.assert_true((select count(*)=0 from public.goals where user_id=current_setting('test.user_b')::uuid),'admin cannot read private goals');
select pg_temp.assert_true((public.admin_list_orders('TEST-ADMIN-1')->0->>'duplicate_reference')::boolean,'duplicate reference detected');
select pg_temp.assert_true(pg_temp.denied($q$select public.admin_review_order(current_setting('test.order')::uuid,'rejected',' ')$q$,'22023'),'reject note required');
select pg_temp.assert_true(public.admin_review_order(current_setting('test.order')::uuid,'paid','TEST verification only')->>'result'='reviewed','approval creates access');
select set_config('test.ends',(select ends_at::text from public.entitlements where source_order_id=current_setting('test.order')::uuid),true);
select pg_temp.assert_true(public.admin_review_order(current_setting('test.order')::uuid,'paid','retry')->>'result'='already_paid','second approval idempotent');
select pg_temp.assert_true((select count(*)=1 and max(ends_at)::text=current_setting('test.ends') from public.entitlements where source_order_id=current_setting('test.order')::uuid),'one entitlement unchanged expiry');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where object_id=current_setting('test.order')),'one approval audit');
select pg_temp.assert_true(public.admin_review_order(current_setting('test.order2')::uuid,'paid','renewal')->>'result'='reviewed','renewal');
select pg_temp.assert_true((select starts_at::text=current_setting('test.ends') and ends_at=starts_at+interval '30 days' from public.entitlements where source_order_id=current_setting('test.order2')::uuid),'renewal adds after previous end');
select pg_temp.assert_true(pg_temp.denied($q$update public.audit_logs set action='changed'$q$,'42501'),'audit append only');
select pg_temp.assert_true(pg_temp.denied($q$update public.orders set status='pending'$q$,'42501'),'admin must use RPC');
select pg_temp.assert_true((select reviewed_by=auth.uid() and reviewed_at is not null from public.orders where id=current_setting('test.order')::uuid),'reviewer recorded');
select set_config('request.jwt.claim.sub',current_setting('test.user_b'),true);
select pg_temp.assert_true(public.get_entitlement()->>'plan'='plus','buyer receives Plus');
select 'PASS: admin assertions; idempotency and renewal; rollback removes all fixtures' as result;
rollback;
