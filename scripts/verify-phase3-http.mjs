import {existsSync,writeFileSync} from 'node:fs';import {loadEnvFile} from 'node:process';import {createClient} from '@supabase/supabase-js';
for(const p of ['.env.local','.env.rls-test'])if(existsSync(p))loadEnvFile(p);
const report={checked_at:new Date().toISOString(),status:'blocked',checks:[],visual:'not run',owner_fixture_isolation:'pending SQL rollback'};const clients=[];let blocked=false;
const base=process.env.RLS_TEST_APP_URL||'http://127.0.0.1:3001';
const check=(name,ok,status)=>{report.checks.push({name,passed:ok,status});if(!ok)throw new Error(`FAIL: ${name}`);};
try{
 const origin=new URL(base);if(!['127.0.0.1','localhost'].includes(origin.hostname)||origin.protocol!=='http:')throw new Error('Gunakan server localhost untuk uji HTTP.');
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';let allowed=key.startsWith('sb_publishable_');try{allowed ||= JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{}
 if(!allowed||process.env.RLS_TEST_ALLOW_FIXTURES!=='dedicated-test-accounts')throw new Error('Public key/akun uji diperlukan.');
 const period='?from=2024-01-01&to=2024-01-31&compare_from=2023-01-01&compare_to=2023-01-31';
 for(const path of ['/api/analytics','/api/advanced-insights','/api/advanced-reports'+period+'&format=csv',...['budget','savings','freelancer','goal'].map(t=>`/api/tools/${t}`)]){const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});check(`anonymous ${path.split('?')[0]}`,r.status===401,r.status);}
 for(const letter of ['A','B']){
  const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(c);const login=await c.auth.signInWithPassword({email:process.env[`RLS_TEST_${letter}_EMAIL`]||'',password:process.env[`RLS_TEST_${letter}_PASSWORD`]||''});if(login.error)throw new Error('Login uji gagal.');
  const plan=await c.rpc('get_effective_plan');if(plan.error)throw new Error('Resolver tidak tersedia.');
  const headers={Authorization:`Bearer ${login.data.session.access_token}`};
  for(const path of ['/api/analytics','/api/advanced-insights','/api/advanced-reports'+period,'/api/advanced-reports'+period+'&format=csv']){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(30000)});if(r.status===503){blocked=true;report.checks.push({name:`${letter} ${path.split('?')[0]}`,passed:null,configuration:'missing RPC/configuration'});continue;}const expected=plan.data==='pro'?200:403;check(`${letter} ${path.includes('format=csv')?'CSV report':path.split('?')[0]} gate`,r.status===expected,r.status);if(expected===200&&path.includes('format=csv'))check(`${letter} report CSV MIME`,r.headers.get('content-type')?.includes('text/csv'),r.status);}
  for(const tool of ['budget','savings','freelancer','goal']){const gate=await c.rpc('can_use_tool',{p_tool:tool});if(gate.error){blocked=true;report.checks.push({name:`${letter} ${tool}`,passed:null,configuration:'migration 012 missing'});continue;}const r=await fetch(base+`/api/tools/${tool}`,{headers,signal:AbortSignal.timeout(30000)});check(`${letter} ${tool} paid gate`,r.status===(gate.data?200:403),r.status);}
 }
 report.status=blocked?'passed_available_checks_configuration_pending':'passed_selected_checks';console.log(`PASS: ${report.checks.filter(c=>c.passed===true).length} HTTP checks; paid new-tool/fixture/visual checks pending.`);
}catch(e){report.reason=e.message;report.status='failed_or_blocked';console.log(e.message);process.exitCode=1;}finally{for(const c of clients)await c.auth.signOut({scope:'local'});writeFileSync('docs/phase3-http-result.json',JSON.stringify(report,null,2)+'\n');}
