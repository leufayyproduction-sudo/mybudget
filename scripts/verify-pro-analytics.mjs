import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {loadEnvFile} from 'node:process';import {createClient} from '@supabase/supabase-js';
for(const path of ['.env.local','.env.rls-test'])if(existsSync(path))loadEnvFile(path);
const report={status:'blocked',checked_at:new Date().toISOString(),checks:[],owner_sql:'pending',mutation:'none'};
const clients=[];
try{
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';let allowed=key.startsWith('sb_publishable_');try{allowed ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{}
 if(!allowed||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Public key dan dua akun khusus diperlukan.');
 const ids=[];
 for(const letter of ['A','B']){const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});clients.push(c);const login=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${letter}_EMAIL`]||'',password:process.env[`RLS_TEST_${letter}_PASSWORD`]||''});if(login.error)throw new Error('Login akun uji gagal; cek konfigurasi lokal.');ids.push(login.data.user.id);}
 if(ids[0]===ids[1])throw new Error('Dua akun harus berbeda.');
 writeFileSync('.rls-pro-analytics-test.sql',readFileSync('supabase/tests/pro_analytics.sql','utf8').replaceAll('__USER_A__',ids[0]).replaceAll('__USER_B__',ids[1]));
 for(const c of clients){const e=await c.rpc('get_effective_plan');if(e.error)throw new Error('Migration 009 belum tersedia; SQL uji lokal sudah disiapkan.');const r=await c.rpc('get_pro_analytics');const ok=e.data==='pro'?!r.error:r.error?.code==='42501';report.checks.push({label:'Pro gate sesuai plan efektif',passed:ok});if(!ok)throw new Error('Gate analytics tidak sesuai plan efektif.');}
 report.status='passed_selected_checks';console.log('PASS gate akun aktual; jalankan SQL rollback lokal untuk Pro/expiry/isolation.');
}catch(e){report.reason=e.message;console.log(`BLOCKED: ${e.message}`);process.exitCode=1;}
finally{for(const c of clients)await c.auth.signOut({scope:'local'});writeFileSync('docs/pro-analytics-result.json',JSON.stringify(report,null,2)+'\n');}
