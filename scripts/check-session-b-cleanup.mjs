// Read-only confirmation after owner removes the temporary test helper.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {loadEnvFile} from 'node:process';import {createClient} from '@supabase/supabase-js';
if(existsSync('.env.local'))loadEnvFile('.env.local');if(existsSync('.env.rls-test'))loadEnvFile('.env.rls-test');
const result={status:'running',checked_at:new Date().toISOString(),checks:[]},clients=[];
function check(label,ok){result.checks.push({label,passed:!!ok});if(!ok)throw new Error(label);console.log(`PASS ${label}`);}
try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 let safe=key?.startsWith('sb_publishable_');try{safe ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
 if(!url||!safe||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts'||!existsSync('.rls-session-b-manifest.json'))throw new Error('Authorized public-key test configuration and manifest required');
 const m=JSON.parse(readFileSync('.rls-session-b-manifest.json','utf8'));let admin,buyer;
 for(const label of ['A','B']){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});clients.push(c);const r=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${label}_EMAIL`],password:process.env[`RLS_TEST_${label}_PASSWORD`]});if(r.error)throw new Error('Test login failed');if(r.data.user.id===m.admin)admin=c;if(r.data.user.id===m.buyer)buyer=c;}
 check('Manifest accounts match existing authorized accounts',!!admin&&!!buyer);
 const role=await admin.rpc('is_admin');check('Existing admin role preserved',!role.error&&role.data===true);
 const ids=Object.values(m.ids);
 for(const [table,column,values] of [['orders','id',ids],['payment_confirmations','order_id',ids],['entitlements','source_order_id',ids],['products','id',[m.product,m.digital]],['download_logs','product_id',[m.digital]],['audit_logs','object_id',ids]]){const c=table==='download_logs'?buyer:admin;const r=await c.from(table).select(column).in(column,values);check(`Test ${table} removed`,!r.error&&r.data.length===0);}
 const plan=await buyer.rpc('get_entitlement');check('Test buyer returned to Free',!plan.error&&plan.data.plan==='free');
 const proof=await admin.storage.from('payment-proofs').download(m.proofPath),file=await admin.storage.from('digital-files').download(m.digitalPath);
 check('Test proof object no longer downloadable',!!proof.error&&/not found|not exist/i.test(proof.error.message));check('Test digital object no longer downloadable',!!file.error&&/not found|not exist/i.test(file.error.message));
 const draft=await admin.from('site_content_draft').select('content').eq('id',1).maybeSingle(),published=await buyer.from('site_content_published').select('content').eq('id',1).maybeSingle();
 check('CMS rollback left no test draft or publication',!draft.error&&!published.error&&draft.data?.content.headline!==`RLS DRAFT ONLY ${m.run}`&&published.data?.content.headline!==`RLS DRAFT ONLY ${m.run}`);
 // A non-admin call has no side effects even if a helper accidentally remains.
 const helper=await buyer.rpc(m.function);check('Temporary cleanup function removed',helper.error?.code==='PGRST202');
 result.status='passed';
}catch(e){result.status='blocked_or_failed';result.error=e.message;process.exitCode=1;console.error(`CHECK: ${e.message}`);}finally{for(const c of clients)await c.auth.signOut({scope:'local'});writeFileSync('docs/session-b-cleanup-result.json',JSON.stringify(result,null,2)+'\n');console.log(`Cleanup verification: ${result.status}`);}
