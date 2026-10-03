import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {loadEnvFile} from 'node:process';import {createClient} from '@supabase/supabase-js';
for(const p of ['.env.local','.env.rls-test'])if(existsSync(p))loadEnvFile(p);
const report={checked_at:new Date().toISOString(),status:'blocked',checks:[],rollback_sql:'pending',parallel_live:'pending',mutation:'none'};const clients=[];
try{
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';let allowed=key.startsWith('sb_publishable_');try{allowed ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{}
 if(!allowed||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Cek public key dan akun uji lokal.');
 const ids=[];
 for(const letter of ['A','B']){const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});clients.push(c);const r=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${letter}_EMAIL`]||'',password:process.env[`RLS_TEST_${letter}_PASSWORD`]||''});if(r.error)throw new Error('Login uji gagal.');ids.push(r.data.user.id);}
 if(ids[0]===ids[1])throw new Error('Dua akun harus berbeda.');
 writeFileSync('.rls-recurring-test.sql',readFileSync('supabase/tests/recurring.sql','utf8').replaceAll('__USER_A__',ids[0]).replaceAll('__USER_B__',ids[1]));
 for(const c of clients){const table=await c.from('recurring_rules').select('id').limit(1);if(table.error)throw new Error('Migration 010 belum tersedia; SQL rollback lokal sudah disiapkan.');const plan=await c.rpc('get_effective_plan');if(plan.error)throw new Error('Migration 009 belum tersedia.');if(!['plus','pro'].includes(plan.data)){const denied=await c.rpc('apply_recurring');const ok=denied.error?.code==='42501';report.checks.push({label:'Free/expired apply denied',passed:ok});if(!ok)throw new Error('Gate recurring gagal.');}}
 report.status='passed_selected_checks';console.log('PASS pemeriksaan akun aktual; SQL rollback dan tes paralel live masih diperlukan.');
}catch(e){report.reason=e.message;console.log(`BLOCKED: ${e.message}`);process.exitCode=1;}finally{for(const c of clients)await c.auth.signOut({scope:'local'});writeFileSync('docs/recurring-result.json',JSON.stringify(report,null,2)+'\n');}
