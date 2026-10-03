// Public key + existing dedicated accounts only. Never reads or prints production credentials.
import {existsSync,writeFileSync,readFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
if(existsSync('.env.local'))loadEnvFile('.env.local');if(existsSync('.env.rls-test'))loadEnvFile('.env.rls-test');
const execute=process.argv.includes('--fixtures');
const checksOnly=process.argv.includes('--checks-only');
const report={status:'running',checked_at:new Date().toISOString(),checks:[],cleanup:'not_needed',fixtures:execute?'requested':'not_created',not_tested:[],real_payments:'not_performed'};
const clients=[],finance=[],files=[];let ordinary,admin,manifest;
const endpoint=process.env.RLS_TEST_APP_URL||'http://127.0.0.1:3001';
function check(label,ok){report.checks.push({label,passed:!!ok});if(!ok)throw new Error(label);console.log(`PASS ${label}`);}
function requireData(r,label){if(r.error)throw new Error(`${label}: ${r.error.code||'API error'}`);return r.data;}
function headers(c){return {Authorization:`Bearer ${c.testToken}`};}
async function http(path,c,options={}){return fetch(endpoint+path,{...options,redirect:'manual',headers:{...headers(c),...options.headers},signal:AbortSignal.timeout(20000)});}
function prepare(owner,buyer){
 const run=randomUUID().replaceAll('-',''),product=randomUUID(),digital=randomUUID();
 const ids={parallel:randomUUID(),repeat:randomUUID(),proof:randomUUID(),digital:randomUUID()};
 const m={run,admin:owner.testId,buyer:buyer.testId,product,digital,ids,proofPath:`${buyer.testId}/${ids.proof}/RLS-TEST-${run}.png`,digitalPath:`${owner.testId}/RLS-TEST-${run}.csv`,function:`rls_cleanup_b_${run.slice(0,16)}`,policy:`rls_delete_b_${run.slice(0,16)}`};
 const testName='RLS TEST ONLY — NO PAYMENT';
 const orderRow=(kind,type,plan,duration)=>`('${ids[kind]}','RLS-${run}-${kind}','${buyer.testId}','${type==='digital_tool'?digital:product}',gen_random_uuid(),'${testName}','${type}',${type==='digital_tool'?5000:9900},${type==='digital_tool'?5000:9900},${duration??'null'},${plan?`'${plan}'`:'null'},'TEST NO MERCHANT','RLS-NO-QRIS','TEST fixture, no payment','${kind==='proof'?'pending':'submitted'}',now()+interval '24 hours',${kind==='proof'?'null':'now()'})`;
 const sql=`-- MANUAL owner setup for live tests. NO QRIS, payment, role creation or CMS publication.
-- Existing admin role is preserved. Temporary cleanup permissions cover two exact test files only.
begin;
do $$ begin
 if '${owner.testId}'::uuid='${buyer.testId}'::uuid then raise exception 'Different accounts required'; end if;
 if not exists(select 1 from public.admin_users where user_id='${owner.testId}') or exists(select 1 from public.admin_users where user_id='${buyer.testId}') then raise exception 'Expected one existing admin and one ordinary account'; end if;
 if exists(select 1 from public.profiles where user_id='${buyer.testId}') or exists(select 1 from public.transactions where user_id='${buyer.testId}') or exists(select 1 from public.budgets where user_id='${buyer.testId}') or exists(select 1 from public.goals where user_id='${buyer.testId}') or exists(select 1 from public.orders where user_id='${buyer.testId}') then raise exception 'Buyer must be a fresh dedicated test account'; end if;
end $$;
insert into public.products(id,code,name,type,price_rupiah,duration_days,plan,active,description) values
('${product}','rls-b-${run}', '${testName}','subscription',9900,30,'plus',false,'TEST ONLY'),
('${digital}','rls-d-${run}', '${testName}','digital_tool',5000,null,null,false,'TEST ONLY');
update public.products set digital_file_path='${m.digitalPath}' where id='${digital}';
insert into public.orders(id,order_number,user_id,product_id,request_id,product_name,product_type,price_rupiah,total_rupiah,duration_days,plan,merchant_name,qris_path,payment_instructions,status,expires_at,submitted_at) values
${[orderRow('parallel','subscription','plus',30),orderRow('repeat','subscription','plus',30),orderRow('proof','subscription','plus',30),orderRow('digital','digital_tool',null,null)].join(',\n')};
insert into public.payment_confirmations(order_id,user_id,reference,note) values
('${ids.parallel}','${buyer.testId}','RLS-${run}-DUP','TEST ONLY'),('${ids.repeat}','${buyer.testId}','RLS-${run}-DUP','TEST ONLY'),('${ids.digital}','${buyer.testId}','RLS-${run}-FILE','TEST ONLY');
create policy ${m.policy} on storage.objects for delete to authenticated using
((auth.uid()='${buyer.testId}'::uuid or auth.uid()='${owner.testId}'::uuid) and ((bucket_id='payment-proofs' and name='${m.proofPath}') or (bucket_id='digital-files' and name='${m.digitalPath}')));
create function public.${m.function}() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is distinct from '${owner.testId}'::uuid or not public.is_admin() then raise exception 'Test cleanup admin required' using errcode='42501'; end if;
 if exists(select 1 from storage.objects where (bucket_id='payment-proofs' and name='${m.proofPath}') or (bucket_id='digital-files' and name='${m.digitalPath}')) then raise exception 'Delete test file bytes through Storage API first'; end if;
 delete from public.download_logs where product_id='${digital}' and user_id='${buyer.testId}';
 delete from public.entitlements where source_order_id in ('${ids.parallel}','${ids.repeat}','${ids.proof}','${ids.digital}') and user_id='${buyer.testId}';
 delete from public.payment_confirmations where order_id in ('${ids.parallel}','${ids.repeat}','${ids.proof}','${ids.digital}') and user_id='${buyer.testId}';
 delete from public.audit_logs where object_id in ('${ids.parallel}','${ids.repeat}','${ids.proof}','${ids.digital}');
 delete from public.orders where id in ('${ids.parallel}','${ids.repeat}','${ids.proof}','${ids.digital}') and user_id='${buyer.testId}';
 delete from public.products where id in ('${product}','${digital}') and code in ('rls-b-${run}','rls-d-${run}');
 execute 'drop policy if exists ${m.policy} on storage.objects';
 return jsonb_build_object('cleanup','passed','admin_role_preserved',exists(select 1 from public.admin_users where user_id='${owner.testId}'));
end $$;
revoke all on function public.${m.function}() from public,anon;
grant execute on function public.${m.function}() to authenticated;
notify pgrst,'reload schema';
commit;
select 'READY: live test fixtures; no payment or QRIS; existing admin preserved' as result;
`;
 const cleanup=`-- Emergency/final owner cleanup. Removes ONLY this run's fixtures and test helper.
begin;
do $$ begin if exists(select 1 from storage.objects where (bucket_id='payment-proofs' and name='${m.proofPath}') or (bucket_id='digital-files' and name='${m.digitalPath}')) then raise exception 'Remove these two test files via Supabase Storage/API before SQL cleanup; do not delete object metadata directly';end if;end $$;
delete from public.download_logs where product_id='${digital}' and user_id='${buyer.testId}';
delete from public.entitlements where source_order_id in ('${ids.parallel}','${ids.repeat}','${ids.proof}','${ids.digital}') and user_id='${buyer.testId}';
delete from public.payment_confirmations where order_id in ('${ids.parallel}','${ids.repeat}','${ids.proof}','${ids.digital}') and user_id='${buyer.testId}';
delete from public.audit_logs where object_id in ('${ids.parallel}','${ids.repeat}','${ids.proof}','${ids.digital}');
delete from public.orders where id in ('${ids.parallel}','${ids.repeat}','${ids.proof}','${ids.digital}') and user_id='${buyer.testId}';
delete from public.products where id in ('${product}','${digital}') and code in ('rls-b-${run}','rls-d-${run}');
drop policy if exists ${m.policy} on storage.objects;
drop function if exists public.${m.function}();
notify pgrst,'reload schema';
commit;
select 'PASS: test fixtures/helper removed; existing admin role unchanged' as result;
`;
 const cms=`-- Owner SQL Editor. Existing admin role preserved. Entire CMS test ROLLBACKS.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
create function pg_temp.denied(command text,code text) returns boolean language plpgsql as $$begin execute command;return false;exception when others then return sqlstate=code;end $$;
select set_config('test.published',coalesce((select jsonb_build_object('content',content,'revision',revision,'published_at',published_at)::text from public.site_content_published where id=1),'null'),true);
select set_config('test.revision',coalesce((select revision::text from public.site_content_draft where id=1),'0'),true);
select set_config('request.jwt.claim.sub','${owner.testId}',true);
set local role authenticated;
select pg_temp.assert_true(public.is_admin(),'existing admin role');
select set_config('test.newrevision',(public.admin_save_site_draft('{"logo_path":null,"headline":"RLS DRAFT ONLY ${run}","description":"TEST NOT PUBLIC","cta_label":"TEST","cta_url":"/?auth=register","feature_heading":"TEST","features":[{"title":"TEST","description":"TEST"}],"steps":[{"title":"TEST","description":"TEST"}],"footer":"TEST"}',current_setting('test.revision')::integer)).revision::text,true);
select set_config('request.jwt.claim.sub','${buyer.testId}',true);
select pg_temp.assert_true((select count(*)=0 from public.site_content_draft),'ordinary user cannot read draft');
select pg_temp.assert_true(pg_temp.denied($q$select public.admin_publish_site(1)$q$,'42501'),'ordinary publish denied');
reset role;
set local role anon;
select pg_temp.assert_true(pg_temp.denied($q$select * from public.site_content_draft$q$,'42501'),'anonymous draft denied');
select pg_temp.assert_true(coalesce((select jsonb_build_object('content',content,'revision',revision,'published_at',published_at)::text from public.site_content_published where id=1),'null')=current_setting('test.published'),'draft does not alter published content');
reset role;
select set_config('request.jwt.claim.sub','${owner.testId}',true);
set local role authenticated;
select pg_temp.assert_true((public.admin_publish_site(current_setting('test.newrevision')::integer)).published_by=auth.uid(),'publish records existing admin');
select 'PASS: CMS draft does not leak; publish authorized; rollback restores draft, publication and audit' as result;
rollback;
`;
 writeFileSync('.rls-session-b-setup.sql',sql);writeFileSync('.rls-session-b-cleanup.sql',cleanup);writeFileSync('.rls-session-b-cms-test.sql',cms);writeFileSync('.rls-session-b-manifest.json',JSON.stringify(m,null,2)+'\n');return m;
}
try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 let safe=key?.startsWith('sb_publishable_');try{safe ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
 if(!url||!safe||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Public key and acknowledged test accounts required');
 for(const label of ['A','B']){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});clients.push(c);const r=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${label}_EMAIL`],password:process.env[`RLS_TEST_${label}_PASSWORD`]});if(r.error)throw new Error('Test account login failed');c.testId=r.data.user.id;c.testToken=r.data.session.access_token;const role=requireData(await c.rpc('is_admin'),'role check');if(role===true){if(admin)throw new Error('Two admins: ordinary test account needed');admin=c;}else ordinary=c;}
 check('One existing admin and one non-admin',!!ordinary&&!!admin&&ordinary.testId!==admin.testId);
 const profile=requireData(await ordinary.from('profiles').select('user_id').limit(1),'dedicated account check');check('Ordinary account has no personal profile',profile.length===0);
 for(const table of ['transactions','budgets','goals']){const rows=requireData(await ordinary.from(table).select('id').limit(1),'dedicated data check');check(`Ordinary account has no pre-existing ${table}`,rows.length===0);}
 const calls=[['admin_purchase_summary',{}],['admin_list_orders',{}],['admin_review_order',{p_order_id:randomUUID(),p_decision:'paid',p_note:''}],['admin_save_product',{p_data:{}}],['admin_save_payment_settings',{p_data:{}}],['admin_record_asset',{p_bucket:'payment-proofs',p_path:'not-owned'}],['admin_save_site_draft',{p_content:{},p_revision:0}],['admin_publish_site',{p_revision:0}]];
 for(const [fn,args] of calls){const r=await ordinary.rpc(fn,args);check(`Non-admin RPC denied: ${fn}`,r.error?.code==='42501');}
 for(const table of ['audit_logs','site_content_draft']){const r=await ordinary.from(table).select('*');check(`Non-admin cannot read ${table}`,!r.error&&r.data.length===0);}
 const roleWrite=await ordinary.from('admin_users').insert({user_id:ordinary.testId});check('Ordinary user cannot grant own admin role',roleWrite.error?.code==='42501');
 const statusWrite=await ordinary.from('orders').update({status:'paid',price_rupiah:1,total_rupiah:1}).eq('id',randomUUID());check('Ordinary user cannot write status or price snapshot',statusWrite.error?.code==='42501');
 const accessWrite=await ordinary.from('entitlements').insert({user_id:ordinary.testId,plan:'pro',starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+86400000).toISOString(),source_order_id:randomUUID()});check('Ordinary user cannot create own entitlement',accessWrite.error?.code==='42501');
 const auditWrite=await admin.from('audit_logs').delete().eq('object_id',randomUUID());check('Admin cannot delete audit logs directly',auditWrite.error?.code==='42501');
 const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const draft=await anon.from('site_content_draft').select('*');check('Anonymous draft read denied',draft.error?.code==='42501');
 const beforePublished=requireData(await anon.from('site_content_published').select('content,revision,published_at'),'published content');
 const drafts=requireData(await admin.from('site_content_draft').select('content,revision'),'admin draft');check('Admin can read draft',Array.isArray(drafts));
 const now=new Date().toISOString().slice(0,10),month=now.slice(0,7);
 const input={transactions:{type:'income',amount:20000,category:'Project',date:now,description:'RLS TEST ONLY'},budgets:{category:'Tagihan',amount:10000,month,mandatory:true},goals:{name:'RLS TEST ONLY',target:20000,saved:0,monthly:0}};
 for(const [table,data] of Object.entries(input)){const id=randomUUID();requireData(await ordinary.from(table).insert({id,user_id:ordinary.testId,data}),'finance fixture');finance.push({table,id});const r=await admin.from(table).select('id').eq('id',id);check(`Admin cannot read another user's ${table}`,!r.error&&r.data.length===0);const update=await admin.from(table).update({data}).eq('id',id).select('id');check(`Admin cannot update another user's ${table}`,!update.error&&update.data.length===0);}
 for(const path of ['/api/admin/purchases','/api/admin/settings','/api/admin/content','/api/admin/proof?order=00000000-0000-4000-8000-000000000001']){const r=await http(path,ordinary);check(`Non-admin HTTP denied: ${path.split('?')[0]}`,r.status===403);}
 for(const path of ['/api/admin/purchases','/api/admin/settings','/api/admin/content']){const r=await http(path,ordinary,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});check(`Non-admin mutation HTTP denied: ${path}`,r.status===403);}
 for(const path of ['/admin','/admin/settings','/admin/content','/admin/content/preview']){const r=await http(path,ordinary,{headers:{Cookie:`mybudget_admin_session=${ordinary.testToken}`}});check(`Non-admin page server denied: ${path}`,r.status===403);}
 const csv=await http('/api/exports/transactions',ordinary);check('Free CSV rejected at server',csv.status===403);
 const download=await http(`/api/downloads/${randomUUID()}`,ordinary);check('Unpaid digital download rejected at server',download.status===403);
 if(!execute){
  if(!checksOnly){if(existsSync('.rls-session-b-manifest.json'))throw new Error('Existing test manifest: use --fixtures after setup, do not overwrite it');manifest=prepare(admin,ordinary);}
  report.fixtures=checksOnly?'not_touched':'setup_prepared_not_executed';report.not_tested=['approval repeat/parallel and renewal','real-byte private proof and paid file','CMS temporary draft separation under concurrent public read'];report.status='partial';
  console.log('MANUAL SQL REQUIRED: .rls-session-b-setup.sql; fixture cleanup .rls-session-b-cleanup.sql. No role changes or payment.');
 }else{
  if(!existsSync('.rls-session-b-manifest.json'))throw new Error('Prepare fixture SQL first');manifest=JSON.parse(readFileSync('.rls-session-b-manifest.json','utf8'));check('Manifest matches authorized test accounts',manifest.admin===admin.testId&&manifest.buyer===ordinary.testId);
  const orders=requireData(await ordinary.from('orders').select('id,status,product_name').in('id',Object.values(manifest.ids)),'fixture orders');check('Four explicit TEST ONLY orders exist',orders.length===4&&orders.every(o=>o.product_name==='RLS TEST ONLY — NO PAYMENT'));report.fixtures='present';
  const approve=async id=>requireData(await admin.rpc('admin_review_order',{p_order_id:id,p_decision:'paid',p_note:'RLS TEST ONLY — no payment received or claimed'}),'test approval');
  const first=await Promise.all([approve(manifest.ids.parallel),approve(manifest.ids.parallel)]);check('Parallel approval: reviewed once and already_paid once',first.filter(r=>r.result==='reviewed').length===1&&first.filter(r=>r.result==='already_paid').length===1);
  const original=requireData(await ordinary.from('entitlements').select('id,starts_at,ends_at').eq('source_order_id',manifest.ids.parallel),'entitlement count');check('Parallel approval produces exactly one entitlement',original.length===1);
  check('Repeated approval is idempotent',(await approve(manifest.ids.parallel)).result==='already_paid');const repeated=requireData(await ordinary.from('entitlements').select('id,ends_at').eq('source_order_id',manifest.ids.parallel),'repeat access');check('Repeated approval does not extend expiry',repeated.length===1&&repeated[0].id===original[0].id&&repeated[0].ends_at===original[0].ends_at);
  const log=requireData(await admin.from('audit_logs').select('id').eq('object_id',manifest.ids.parallel),'approval audit');check('Only one approval audit entry',log.length===1);
  check('Second order approved',(await approve(manifest.ids.repeat)).result==='reviewed');check('Second order retry idempotent',(await approve(manifest.ids.repeat)).result==='already_paid');const renewal=requireData(await ordinary.from('entitlements').select('starts_at,ends_at').eq('source_order_id',manifest.ids.repeat),'renewal');check('Renewal starts at previous expiry and adds 30 days',renewal.length===1&&renewal[0].starts_at===original[0].ends_at&&new Date(renewal[0].ends_at)-new Date(renewal[0].starts_at)===30*86400000);
  const proof=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/f9sAAAAASUVORK5CYII=','base64');
  requireData(await ordinary.storage.from('payment-proofs').upload(manifest.proofPath,proof,{contentType:'image/png',upsert:false}),'test proof upload');files.push({c:ordinary,bucket:'payment-proofs',path:manifest.proofPath});
  const publicProof=await fetch(`${url}/storage/v1/object/public/payment-proofs/${manifest.proofPath}`,{signal:AbortSignal.timeout(15000)});check('Existing proof bytes cannot be read via public URL',!publicProof.ok);
  const denied=await anon.storage.from('payment-proofs').download(manifest.proofPath);check('Anonymous proof download denied',!!denied.error);
  const ownerProof=requireData(await ordinary.storage.from('payment-proofs').download(manifest.proofPath),'owner proof download');check('Owner reads exact test proof',createHash('sha256').update(Buffer.from(await ownerProof.arrayBuffer())).digest('hex')===createHash('sha256').update(proof).digest('hex'));
  const adminProof=requireData(await admin.storage.from('payment-proofs').createSignedUrl(manifest.proofPath,60),'admin proof signed URL');const signed=await fetch(adminProof.signedUrl,{signal:AbortSignal.timeout(15000)});check('Admin short-lived proof signed URL works',signed.ok);
  const confirmed=requireData(await ordinary.rpc('submit_payment_confirmation',{p_order_id:manifest.ids.proof,p_reference:`RLS-${manifest.run}-PROOF`,p_note:'TEST ONLY, NOT A REAL PAYMENT',p_proof_path:manifest.proofPath}),'test proof confirmation');check('Confirmation is submitted, not paid',confirmed.status==='submitted');const proofAccess=requireData(await ordinary.from('entitlements').select('id').eq('source_order_id',manifest.ids.proof),'confirmation access');check('Confirmation grants no entitlement',proofAccess.length===0);
  const file=Buffer.from('label;amount\nRLS TEST ONLY;20000\n');requireData(await admin.storage.from('digital-files').upload(manifest.digitalPath,file,{contentType:'text/csv',upsert:false}),'test digital upload');files.push({c:admin,bucket:'digital-files',path:manifest.digitalPath});
  const unpaid=await ordinary.rpc('get_paid_download',{p_product_id:manifest.digital});check('Unpaid fixture file rejected',unpaid.error?.code==='42501');await approve(manifest.ids.digital);const rights=requireData(await ordinary.rpc('get_paid_download',{p_product_id:manifest.digital}),'paid file rights');check('Paid fixture file grants correct private path',rights===manifest.digitalPath);const publicFile=await fetch(`${url}/storage/v1/object/public/digital-files/${manifest.digitalPath}`,{signal:AbortSignal.timeout(15000)});check('Paid file has no public download URL',!publicFile.ok);const paidSigned=requireData(await ordinary.storage.from('digital-files').createSignedUrl(rights,60),'paid signed URL');check('Paid buyer signed download succeeds',(await fetch(paidSigned.signedUrl,{signal:AbortSignal.timeout(15000)})).ok);
  const afterPublished=requireData(await anon.from('site_content_published').select('content,revision,published_at'),'published recheck');check('Public published content unchanged by live tests',JSON.stringify(beforePublished)===JSON.stringify(afterPublished));
  report.not_tested=['temporary draft change + rollback must be run in owner SQL; live read isolation was tested','visual and merchant/payment tests excluded'];report.status='passed_selected_checks';
 }
}catch(e){report.status='blocked_or_failed';report.error=e.message;console.error(`VERIFICATION: ${e.message}`);process.exitCode=1;}
finally{
 report.cleanup='passed';
 for(const f of files.reverse()){const r=await f.c.storage.from(f.bucket).remove([f.path]);if(r.error){report.cleanup='failed';report.cleanup_error='Storage fixture cleanup failed; use exact test paths from manifest';process.exitCode=1;}}
 for(const f of finance.reverse()){const r=await ordinary.from(f.table).delete().eq('id',f.id);const remaining=await ordinary.from(f.table).select('id').eq('id',f.id);if(r.error||remaining.error||remaining.data.length){report.cleanup='failed';process.exitCode=1;}}
 if(execute&&manifest&&report.fixtures==='present'&&report.cleanup==='passed'){const r=await admin.rpc(manifest.function);if(r.error||r.data?.cleanup!=='passed'){report.cleanup='failed';report.cleanup_error='Owner fixture cleanup needed';process.exitCode=1;}else{report.fixtures='removed';report.helper_cleanup='Owner must run .rls-session-b-cleanup.sql to drop temporary cleanup function';}}
 for(const c of clients)await c.auth.signOut({scope:'local'});
 writeFileSync('docs/session-b-live-result.json',JSON.stringify(report,null,2)+'\n');console.log(`RESULT ${report.status}; CLEANUP ${report.cleanup}. Report docs/session-b-live-result.json`);
}
