import {readFileSync,existsSync,writeFileSync} from 'node:fs';import {loadEnvFile} from 'node:process';import {createClient} from '@supabase/supabase-js';
for(const p of ['.env.local','.env.rls-test'])if(existsSync(p))loadEnvFile(p);
const report={checked_at:new Date().toISOString(),status:'blocked',cleanup:'pending',helper_cleanup:'owner SQL still required'};let c,ready=false,run;
try{
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';let publicKey=key.startsWith('sb_publishable_');try{publicKey ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{}
 if(!publicKey||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Public key dan akun uji diperlukan.');
 const manifest=JSON.parse(readFileSync('.rls-phase3-parallel-manifest.json'));run=manifest.run;
 c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
 const login=await c.auth.signInWithPassword({email:process.env.RLS_TEST_A_EMAIL||'',password:process.env.RLS_TEST_A_PASSWORD||''});if(login.error||login.data.user.id!==manifest.user)throw new Error('Akun A/manifest tidak cocok.');
 const before=await c.rpc('phase3_parallel_status',{p_run:run});if(before.error)throw new Error('SQL setup belum READY.');ready=true;
 if(before.data.occurrences!==0||before.data.transactions!==0)throw new Error('Fixture tidak bersih; jalankan cleanup, jangan ulang tanpa setup baru.');
 const calls=await Promise.all([c.rpc('apply_recurring'),c.rpc('apply_recurring')]);
 if(calls.some(r=>r.error)||calls.map(r=>r.data.created).sort().join(',')!=='0,1')throw new Error('FAIL: hasil dua apply paralel bukan 0/1.');
 const after=await c.rpc('phase3_parallel_status',{p_run:run});if(after.error||after.data.occurrences!==1||after.data.transactions!==1)throw new Error('FAIL: ledger/transaksi bukan satu.');
 const retry=await c.rpc('apply_recurring');if(retry.error||retry.data.created!==0)throw new Error('FAIL: retry tidak idempotent.');
 report.status='passed';console.log('PASS: dua RPC paralel + retry, satu ledger dan transaksi.');
}catch(e){report.reason=e.message;console.log(`BLOCKED/FAIL: ${e.message}`);process.exitCode=1;}
finally{if(c&&ready){const cleanup=await c.rpc('phase3_parallel_cleanup',{p_run:run});report.cleanup=cleanup.error?'failed':'passed';if(cleanup.error)process.exitCode=1;}if(c)await c.auth.signOut({scope:'local'});writeFileSync('docs/phase3-parallel-result.json',JSON.stringify(report,null,2)+'\n');}
