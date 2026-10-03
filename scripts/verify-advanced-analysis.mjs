import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {loadEnvFile} from 'node:process';import {createClient} from '@supabase/supabase-js';
for(const p of ['.env.local','.env.rls-test'])if(existsSync(p))loadEnvFile(p);
const report={status:'blocked',checked_at:new Date().toISOString(),checks:[],owner_sql:'pending',http_paid_access:'pending',mutation:'none'};const clients=[];
try{
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';let publicKey=key.startsWith('sb_publishable_');try{publicKey ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{}
 if(!publicKey||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Public key dan akun uji lokal diperlukan.');
 const ids=[];
 for(const letter of ['A','B']){const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});clients.push(c);const login=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${letter}_EMAIL`]||'',password:process.env[`RLS_TEST_${letter}_PASSWORD`]||''});if(login.error)throw new Error('Login uji gagal; cek konfigurasi lokal.');ids.push(login.data.user.id);}
 if(ids[0]===ids[1])throw new Error('Akun uji harus berbeda.');
 writeFileSync('.rls-advanced-analysis-test.sql',readFileSync('supabase/tests/advanced_analysis.sql','utf8').replaceAll('__USER_A__',ids[0]).replaceAll('__USER_B__',ids[1]));
 for(const c of clients){const plan=await c.rpc('get_effective_plan');if(plan.error)throw new Error('Resolver plan belum tersedia.');const r=await c.rpc('get_advanced_insight_data');if(r.error?.code==='PGRST202')throw new Error('Migration 011 belum tersedia; SQL rollback lokal sudah disiapkan.');const ok=plan.data==='pro'?!r.error:r.error?.code==='42501';report.checks.push({label:'Insight gate sesuai plan akun aktual',passed:ok});if(!ok)throw new Error('Insight gate tidak sesuai.');}
 report.status='passed_selected_checks';console.log('PASS gate akun aktual; assertions rollback/live lainnya masih diperlukan.');
}catch(e){report.reason=e.message;console.log(`BLOCKED: ${e.message}`);process.exitCode=1;}finally{for(const c of clients)await c.auth.signOut({scope:'local'});writeFileSync('docs/advanced-analysis-result.json',JSON.stringify(report,null,2)+'\n');}
