import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';
if(existsSync('.env.local'))loadEnvFile('.env.local');if(existsSync('.env.rls-test'))loadEnvFile('.env.rls-test');
const result={status:'blocked',checked_at:new Date().toISOString(),checks:[],sql:'pending',parallel_approval:'pending',payments:'not_tested'};const clients=[];
function check(label,ok){result.checks.push({label,passed:ok});if(!ok)throw new Error(label);console.log(`PASS ${label}`);}
try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 let safe=key?.startsWith('sb_publishable_');try{safe ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
 if(!url||!safe||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Konfigurasi public key dan dua akun uji khusus diperlukan.');
 for(const letter of ['A','B']){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});clients.push(c);const r=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${letter}_EMAIL`],password:process.env[`RLS_TEST_${letter}_PASSWORD`]});if(r.error)throw new Error('Login akun uji gagal.');c.testId=r.data.user.id;}
 check('Dua akun berbeda',clients[0].testId!==clients[1].testId);
 writeFileSync('.rls-admin-test.sql',readFileSync('supabase/tests/admin_purchases.sql','utf8').replaceAll('__USER_A__',clients[0].testId).replaceAll('__USER_B__',clients[1].testId));
 for(const c of clients){const role=await c.rpc('is_admin');check('Akun uji bukan admin',!role.error&&role.data===false);
  for(const [fn,args] of [['admin_purchase_summary',{}],['admin_list_orders',{}],['admin_review_order',{p_order_id:'00000000-0000-4000-8000-000000000001',p_decision:'paid',p_note:''}]]){const r=await c.rpc(fn,args);if(r.error?.code==='PGRST202')throw new Error('Terapkan migration 006 dahulu.');check(`Non-admin ditolak: ${fn}`,r.error?.code==='42501');}
  const log=await c.from('audit_logs').select('*');check('Audit tidak terbaca non-admin',!log.error&&log.data.length===0);
 }
 result.status='passed';
}catch(e){console.error(`VERIFICATION BLOCKED: ${e.message}`);process.exitCode=1;}finally{for(const c of clients)await c.auth.signOut();writeFileSync('docs/admin-result.json',JSON.stringify(result,null,2)+'\n');console.log(`Hasil: ${result.status}. Tes owner SQL: .rls-admin-test.sql; approval paralel belum diuji.`);}
